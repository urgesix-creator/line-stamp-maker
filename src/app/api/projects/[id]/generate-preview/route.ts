import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePreview } from "@/lib/generation";

export const runtime = "nodejs";
export const maxDuration = 300;

// 先行4枚の生成を開始（S4最終確認 →S5）。
// サーバー関数として最後まで走るため、ブラウザを閉じても生成は継続する。
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

  // 既に生成中/生成済みなら二重起動しない
  if (project.status !== "draft" && project.status !== "preview_generating") {
    return NextResponse.json({ ok: true, status: project.status });
  }

  try {
    await generatePreview(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[generate-preview]", e);
    // 失敗時はdraftに戻す（回数は消費されない）
    await admin.from("projects").update({ status: "draft" }).eq("id", id);
    return NextResponse.json(
      { error: "生成に失敗しました。回数は消費されていません。もう一度お試しください" },
      { status: 500 },
    );
  }
}
