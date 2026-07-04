import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { manualStampSlots, type ManualStampPhase } from "@/lib/codex";
import { processStamp } from "@/lib/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { stampPath, uploadStamp } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function isManualPhase(value: FormDataEntryValue | null): value is ManualStampPhase {
  return value === "preview" || value === "remaining" || value === "all";
}

function slotName(no: number) {
  return String(no).padStart(2, "0");
}

// Codexで生成した完成PNGを取り込む。
// 文字は画像内に描かれている前提で、ここではLINE規格への整形と保存だけを行う。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id,status")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.owner_id !== profile.id && profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (project.status === "completed") {
    return NextResponse.json(
      { error: "完成済みのセットには取り込めません" },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const phaseValue = form.get("phase");
  if (!isManualPhase(phaseValue)) {
    return NextResponse.json({ error: "取り込み範囲が不正です" }, { status: 400 });
  }

  const slots = manualStampSlots(phaseValue);
  const missing = slots.filter((no) => {
    const file = form.get(`slot-${slotName(no)}`);
    return !file || typeof file === "string";
  });
  if (missing.length) {
    return NextResponse.json(
      { error: `${missing.map(slotName).join(", ")} の画像が足りません` },
      { status: 400 },
    );
  }

  try {
    for (const no of slots) {
      const slot = slotName(no);
      const file = form.get(`slot-${slot}`);
      if (!file || typeof file === "string") continue;
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `${slot}.png は画像ファイルではありません` },
          { status: 400 },
        );
      }
      if (file.size > MAX_SOURCE_BYTES) {
        return NextResponse.json(
          { error: `${slot}.png は20MB以下にしてください` },
          { status: 400 },
        );
      }

      const source = Buffer.from(await file.arrayBuffer());
      const processed = await processStamp(source);
      const path = stampPath(project.owner_id, id, slot);
      await uploadStamp(path, processed);
      await admin.from("stamp_images").upsert(
        {
          project_id: id,
          slot,
          storage_path: path,
          review_state: "unconfirmed",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,slot" },
      );
    }

    const nextStatus = phaseValue === "preview" ? "preview_review" : "full_review";
    await admin.from("projects").update({ status: nextStatus }).eq("id", id);
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e) {
    console.error("[manual-stamps]", e);
    return NextResponse.json({ error: "画像の取り込みに失敗しました" }, { status: 500 });
  }
}
