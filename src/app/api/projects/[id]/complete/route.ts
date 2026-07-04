import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeProject } from "@/lib/generation";

export const runtime = "nodejs";
export const maxDuration = 120;

// 全16枚OK確定（S6 →S7）。全スロットがOKであることを確認し、main/tab生成＋完成化。
export async function POST(
  _req: Request,
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
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // 16枚すべてOKか検証
  const { data: images } = await admin
    .from("stamp_images")
    .select("slot,review_state")
    .eq("project_id", id);
  const numbered = (images ?? []).filter((i) => /^\d\d$/.test(i.slot));
  const allOk =
    numbered.length >= 16 && numbered.every((i) => i.review_state === "ok");
  if (!allOk) {
    return NextResponse.json(
      { error: "まだOKになっていないスタンプがあります" },
      { status: 400 },
    );
  }

  try {
    await finalizeProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[complete]", e);
    return NextResponse.json({ error: "完成処理に失敗しました" }, { status: 500 });
  }
}
