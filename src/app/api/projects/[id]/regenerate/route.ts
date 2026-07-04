import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateOne } from "@/lib/generation";

export const runtime = "nodejs";
export const maxDuration = 120;

// 個別再生成（F5）。上限チェック→再生成→成功時に残数を1消費。
// 上限到達時は 403 を返し、UIは申請フロー（F10）へ誘導する。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { no } = (await req.json()) as { no: number; reason?: string };

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id,regen_remaining")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (project.regen_remaining <= 0) {
    return NextResponse.json(
      { error: "limit_reached", message: "作り直しの回数上限に達しました" },
      { status: 403 },
    );
  }

  const ok = await regenerateOne(id, no);
  if (!ok) {
    // 失敗は回数消費しない（F5 / 生成失敗時の不算入）
    return NextResponse.json(
      { error: "生成に失敗しました。回数は消費されていません" },
      { status: 500 },
    );
  }

  // 誤字理由でも上限枠を消費する（F5）
  await admin
    .from("projects")
    .update({ regen_remaining: project.regen_remaining - 1 })
    .eq("id", id);

  return NextResponse.json({ ok: true, regen_remaining: project.regen_remaining - 1 });
}
