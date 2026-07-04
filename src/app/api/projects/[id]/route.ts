import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, BUCKETS } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import type { PhraseItem, WizardAnswers } from "@/lib/types";

// 自動保存（F2）：ウィザード回答・文言の更新。RLSにより本人のみ更新可能。
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as {
    answers?: WizardAnswers;
    phrases?: PhraseItem[];
  };

  const patch: Record<string, unknown> = {};
  if (body.answers) patch.answers = body.answers;
  if (body.phrases) patch.phrases = body.phrases;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) {
    console.error("[projects.patch]", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

// プロジェクト削除。DBの関連行はカスケード削除されるが、ストレージの実ファイル
// （アップロード写真・生成スタンプ）は明示的に削除する必要があるため個別に消す。
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();

  // 所有者確認（本人 or 管理者のみ削除可）
  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.owner_id !== profile.id && profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // ① スタンプ画像（stampsバケット）の実ファイルを収集して削除
  const { data: images } = await admin
    .from("stamp_images")
    .select("storage_path,prev_storage_path")
    .eq("project_id", id);
  const stampPaths: string[] = [];
  for (const img of images ?? []) {
    if (img.storage_path) stampPaths.push(img.storage_path);
    if (img.prev_storage_path) stampPaths.push(img.prev_storage_path);
  }
  if (stampPaths.length) {
    await admin.storage.from(BUCKETS.stamps).remove(stampPaths);
  }

  // ② アップロード写真（uploadsバケット）の実ファイルを削除
  const { data: photos } = await admin
    .from("upload_photos")
    .select("storage_path")
    .eq("project_id", id);
  const photoPaths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
  if (photoPaths.length) {
    await admin.storage.from(BUCKETS.photos).remove(photoPaths);
  }

  // ③ プロジェクト本体を削除（stamp_images / upload_photos / quota_requests /
  //    gen_logs はDBのON DELETE CASCADEで自動削除される）
  const { error } = await admin.from("projects").delete().eq("id", id);
  if (error) {
    console.error("[projects.delete]", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
