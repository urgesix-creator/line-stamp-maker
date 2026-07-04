import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadStamp } from "@/lib/storage";
import { STAMP_RETENTION_DAYS } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

// ZIP一括ダウンロード（S7 / F6）。01〜16.png / main.png / tab.png。
// 完成済み・90日以内・本人（または管理者）のみ。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id,status,completed_at")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.owner_id !== profile.id && profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (project.status !== "completed" || !project.completed_at)
    return NextResponse.json({ error: "まだ完成していません" }, { status: 400 });

  // 90日超過チェック
  const age = Date.now() - new Date(project.completed_at).getTime();
  if (age > STAMP_RETENTION_DAYS * 24 * 3600 * 1000)
    return NextResponse.json({ error: "保存期間が終了しました" }, { status: 410 });

  const { data: images } = await admin
    .from("stamp_images")
    .select("slot,storage_path")
    .eq("project_id", id);

  const zip = new JSZip();
  for (const img of images ?? []) {
    if (!img.storage_path) continue;
    if (!/^(\d\d|main|tab)$/.test(img.slot)) continue; // _prev等は除外
    try {
      const buf = await downloadStamp(img.storage_path);
      zip.file(`${img.slot}.png`, buf);
    } catch (e) {
      console.error(`[zip] ${img.slot} failed`, e);
    }
  }

  const content = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(content as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="line-stamps-${id}.zip"`,
    },
  });
}
