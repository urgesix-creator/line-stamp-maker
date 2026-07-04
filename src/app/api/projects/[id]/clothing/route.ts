import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { changeClothing, revertClothing } from "@/lib/generation";
import { CLOTHING_BANNED_WORDS } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

function containsBanned(text: string): boolean {
  const lower = text.toLowerCase();
  return CLOTHING_BANNED_WORDS.some((w) => lower.includes(w.toLowerCase()));
}

// 服装変更（F9）。禁止ワード判定→上限チェック→編集→成功時に残数を1消費。
// action:'revert' で直前1世代へ復元（回数は消費しない）。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as {
    no: number;
    instruction?: string;
    action?: "revert";
  };

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id,clothing_remaining")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // 元にもどす
  if (body.action === "revert") {
    const ok = await revertClothing(id, body.no);
    return NextResponse.json({ ok });
  }

  const instruction = (body.instruction ?? "").trim();
  if (!instruction)
    return NextResponse.json({ error: "服装の指示を入力してください" }, { status: 400 });

  // 禁止ワード判定（拒否分は回数不消費）
  if (containsBanned(instruction)) {
    return NextResponse.json(
      { error: "この内容では変更できません。別の表現でお試しください" },
      { status: 400 },
    );
  }

  // 上限チェック
  if (project.clothing_remaining <= 0) {
    return NextResponse.json(
      { error: "limit_reached", message: "服装変更の回数上限に達しました" },
      { status: 403 },
    );
  }

  const ok = await changeClothing(id, body.no, instruction);
  if (!ok) {
    return NextResponse.json(
      { error: "変更に失敗しました。回数は消費されていません" },
      { status: 500 },
    );
  }

  await admin
    .from("projects")
    .update({ clothing_remaining: project.clothing_remaining - 1 })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    clothing_remaining: project.clothing_remaining - 1,
  });
}
