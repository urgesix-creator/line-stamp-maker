import { createAdminClient } from "./supabase/admin";
import { generateImage, generateWithReference, editImage } from "./openai";
import { processStamp, makeMain, makeTab, toPng } from "./image";
import {
  buildStampPrompt,
  buildClothingEditPrompt,
  buildCharacterPortraitPrompt,
} from "./prompt";
import {
  uploadStamp,
  stampPath,
  downloadStamp,
  downloadPhoto,
} from "./storage";
import { PREVIEW_NUMBERS, IMAGE_NUMBERS } from "./constants";
import type { GenKind } from "./constants";
import type { PhraseItem, Project, WizardAnswers } from "./types";

// ─────────────────────────────────────────────────────────────
// 生成オーケストレーション（F3 / F4 / F5 / F9）
// ・16枚は順次生成（レート制限考慮）
// ・2枚目以降は1枚目の生成画像を参照してキャラ一貫性を維持
// ・失敗分は上限・費用に不算入（gen_logs.success=false）
// ・サーバー関数として最後まで走るためブラウザを閉じても継続する
// ─────────────────────────────────────────────────────────────

const slotName = (n: number) => String(n).padStart(2, "0");

async function logGen(
  userId: string,
  projectId: string,
  kind: GenKind,
  success: boolean,
) {
  const admin = createAdminClient();
  await admin.from("gen_logs").insert({
    user_id: userId,
    project_id: projectId,
    kind,
    success,
  });
}

async function getProject(projectId: string): Promise<Project> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error || !data) throw error ?? new Error("project not found");
  return data as Project;
}

/** 指定スロットの整形済みPNGを取得（参照画像用） */
async function getReferenceBuffer(
  userId: string,
  projectId: string,
  slot = "01",
): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stamp_images")
    .select("storage_path")
    .eq("project_id", projectId)
    .eq("slot", slot)
    .maybeSingle();
  if (!data?.storage_path) return null;
  try {
    return await downloadStamp(data.storage_path);
  } catch {
    return null;
  }
}

/** プロジェクトの最初のアップロード写真を取得（キャラ土台の元画像） */
async function loadFirstPhoto(projectId: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("upload_photos")
    .select("storage_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.storage_path) return null;
  try {
    return await downloadPhoto(data.storage_path);
  } catch {
    return null;
  }
}

/**
 * キャラクターの土台（本人の似顔絵・文字なし）を用意する（F3）。
 * ・既に生成済み（slot 'base'）ならそれを返す
 * ・写真があれば、写真から手描き風キャラを生成して保存し返す
 * ・写真が無ければ null（文字情報＋特徴テキストからの生成にフォールバック）
 * 全16枚はこの土台を参照して描くため、本人に似て、かつ一貫する。
 */
async function ensureCharacterBase(project: Project): Promise<Buffer | null> {
  const admin = createAdminClient();
  // 既存の土台
  const existing = await getReferenceBuffer(project.owner_id, project.id, "base");
  if (existing) return existing;

  const photo = await loadFirstPhoto(project.id);
  if (!photo) return null; // 写真なしフロー

  try {
    const pngPhoto = await toPng(photo); // JPG/HEIC由来でもPNGに正規化
    const prompt = buildCharacterPortraitPrompt(project.answers as WizardAnswers);
    const res = await editImage(prompt, pngPhoto);
    const path = stampPath(project.owner_id, project.id, "base");
    await uploadStamp(path, res.buffer);
    await admin.from("stamp_images").upsert(
      {
        project_id: project.id,
        slot: "base",
        storage_path: path,
        review_state: "ok",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,slot" },
    );
    return res.buffer;
  } catch (e) {
    console.error("[character-base] failed:", e);
    return null;
  }
}

/** 1枚を生成→整形→保存→DB反映。成否を返す。 */
async function generateOne(
  project: Project,
  phrase: PhraseItem,
  kind: GenKind,
  reference: Buffer | null,
): Promise<{ ok: boolean; buffer?: Buffer }> {
  const admin = createAdminClient();
  const slot = slotName(phrase.no);
  const prompt = buildStampPrompt(project.answers as WizardAnswers, phrase);

  try {
    const raw = reference
      ? await generateWithReference(prompt, reference)
      : await generateImage(prompt);
    const processed = await processStamp(raw.buffer);
    const path = stampPath(project.owner_id, project.id, slot);
    await uploadStamp(path, processed);

    await admin.from("stamp_images").upsert(
      {
        project_id: project.id,
        slot,
        storage_path: path,
        review_state: "unconfirmed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,slot" },
    );
    await logGen(project.owner_id, project.id, kind, true);
    return { ok: true, buffer: processed };
  } catch (e) {
    console.error(`[gen] slot ${slot} failed:`, e);
    await logGen(project.owner_id, project.id, kind, false);
    return { ok: false };
  }
}

/** 先行4枚生成（S5）。1枚目→参照→2..4枚目。 */
export async function generatePreview(projectId: string): Promise<void> {
  const admin = createAdminClient();
  const project = await getProject(projectId);
  await admin
    .from("projects")
    .update({ status: "preview_generating" })
    .eq("id", projectId);

  const phrases = project.phrases as PhraseItem[];
  // 写真があれば本人の土台キャラを先に作り、全枚それを参照する
  const base = await ensureCharacterBase(project);
  let slot01Buf: Buffer | null = null;

  for (const no of PREVIEW_NUMBERS) {
    const phrase = phrases.find((p) => p.no === no)!;
    // 土台があれば常にそれを参照。無ければ（写真なし）1枚目を基準に一貫性を取る。
    const reference = base ?? (no === 1 ? null : slot01Buf);
    const res = await generateOne(project, phrase, "preview", reference);
    if (res.ok && no === 1 && res.buffer) slot01Buf = res.buffer;
  }

  await admin
    .from("projects")
    .update({ status: "preview_review" })
    .eq("id", projectId);
}

/** 残り12枚生成（S6）。5..16枚目、slot01を参照。 */
export async function generateRemaining(projectId: string): Promise<void> {
  const admin = createAdminClient();
  const project = await getProject(projectId);
  await admin
    .from("projects")
    .update({ status: "main_generating" })
    .eq("id", projectId);

  const phrases = project.phrases as PhraseItem[];
  // 土台（本人キャラ）を優先。無ければ slot01 を参照して一貫性を維持。
  const reference =
    (await ensureCharacterBase(project)) ??
    (await getReferenceBuffer(project.owner_id, projectId));

  for (const no of IMAGE_NUMBERS.filter((n) => n > 4)) {
    const phrase = phrases.find((p) => p.no === no)!;
    await generateOne(project, phrase, "main", reference);
  }

  await admin
    .from("projects")
    .update({ status: "full_review" })
    .eq("id", projectId);
}

/** 個別再生成（F5）。上限は呼び出し側でチェック済み前提。成否を返す。 */
export async function regenerateOne(
  projectId: string,
  no: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const project = await getProject(projectId);
  const phrases = project.phrases as PhraseItem[];
  const phrase = phrases.find((p) => p.no === no);
  if (!phrase) throw new Error("invalid slot");

  // 土台（本人キャラ）を優先。無ければ slot01（1枚目のみnull）を参照。
  const reference =
    (await ensureCharacterBase(project)) ??
    (no === 1 ? null : await getReferenceBuffer(project.owner_id, projectId));
  const res = await generateOne(project, phrase, "regen", reference);

  if (res.ok) {
    const slot = slotName(no);
    const { data: cur } = await admin
      .from("stamp_images")
      .select("regen_count")
      .eq("project_id", projectId)
      .eq("slot", slot)
      .maybeSingle();
    await admin
      .from("stamp_images")
      .update({
        review_state: "unconfirmed",
        regen_count: (cur?.regen_count ?? 0) + 1,
      })
      .eq("project_id", projectId)
      .eq("slot", slot);
  }
  return res.ok;
}

/** 服装変更（F9）。元画像＋指示で編集。直前1世代を保存。成否を返す。 */
export async function changeClothing(
  projectId: string,
  no: number,
  instruction: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const project = await getProject(projectId);
  const slot = slotName(no);

  const { data: img } = await admin
    .from("stamp_images")
    .select("*")
    .eq("project_id", projectId)
    .eq("slot", slot)
    .single();
  if (!img?.storage_path) throw new Error("image not found");

  try {
    const source = await downloadStamp(img.storage_path);
    const prompt = buildClothingEditPrompt(instruction);
    const edited = await editImage(prompt, source);
    const processed = await processStamp(edited.buffer);

    // 直前1世代を退避（元にもどす用）。別パスに現行画像を保存。
    const prevPath = `${project.owner_id}/${project.id}/${slot}_prev.png`;
    await uploadStamp(prevPath, source);

    const path = stampPath(project.owner_id, project.id, slot);
    await uploadStamp(path, processed);

    const history = Array.isArray(img.clothing_history) ? img.clothing_history : [];
    await admin
      .from("stamp_images")
      .update({
        storage_path: path,
        prev_storage_path: prevPath,
        review_state: "unconfirmed",
        clothing_history: [
          ...history,
          { instruction, at: new Date().toISOString(), prev_path: prevPath },
        ],
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("slot", slot);

    await logGen(project.owner_id, projectId, "clothing", true);
    return true;
  } catch (e) {
    console.error("[clothing] failed:", e);
    await logGen(project.owner_id, projectId, "clothing", false);
    return false;
  }
}

/** 元にもどす（直前1世代へ復元・F9） */
export async function revertClothing(
  projectId: string,
  no: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const slot = slotName(no);
  const { data: img } = await admin
    .from("stamp_images")
    .select("*")
    .eq("project_id", projectId)
    .eq("slot", slot)
    .single();
  if (!img?.prev_storage_path) return false;

  try {
    const prev = await downloadStamp(img.prev_storage_path);
    // 現在の表示パスへ直前世代を書き戻す
    await uploadStamp(img.storage_path, prev);
    await admin
      .from("stamp_images")
      .update({
        prev_storage_path: null,
        review_state: "unconfirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("slot", slot);
    return true;
  } catch (e) {
    console.error("[revert] failed:", e);
    return false;
  }
}

/** 完成確定時：main.png / tab.png を生成し、削除予定日(90日)を設定 */
export async function finalizeProject(projectId: string): Promise<void> {
  const admin = createAdminClient();
  const project = await getProject(projectId);

  const stamp01Buf = await getReferenceBuffer(project.owner_id, projectId);
  if (stamp01Buf) {
    const mainBuf = await makeMain(stamp01Buf);
    const tabBuf = await makeTab(stamp01Buf);
    const mainPath = stampPath(project.owner_id, projectId, "main");
    const tabPath = stampPath(project.owner_id, projectId, "tab");
    await uploadStamp(mainPath, mainBuf);
    await uploadStamp(tabPath, tabBuf);
    for (const [slot, path] of [
      ["main", mainPath],
      ["tab", tabPath],
    ] as const) {
      await admin.from("stamp_images").upsert(
        {
          project_id: projectId,
          slot,
          storage_path: path,
          review_state: "ok",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,slot" },
      );
    }
  }

  const completedAt = new Date();
  const deleteAfter = new Date(completedAt.getTime() + 90 * 24 * 3600 * 1000);
  await admin
    .from("projects")
    .update({
      status: "completed",
      completed_at: completedAt.toISOString(),
    })
    .eq("id", projectId);

  // 全画像に削除予定日(90日)を設定
  await admin
    .from("stamp_images")
    .update({ delete_after: deleteAfter.toISOString() })
    .eq("project_id", projectId);

  // アップロード写真は生成完了+7日で削除予定
  const photoDelete = new Date(completedAt.getTime() + 7 * 24 * 3600 * 1000);
  await admin
    .from("upload_photos")
    .update({ delete_after: photoDelete.toISOString() })
    .eq("project_id", projectId);
}
