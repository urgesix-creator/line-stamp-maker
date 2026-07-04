import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthlySetsUsed } from "@/lib/quota";
import { DEFAULT_PHRASES } from "@/lib/constants";
import type { PhraseItem } from "@/lib/types";

// 新規プロジェクト作成（S3 →S4）。月間上限を超えていたらブロック（F8 / 受入6）。
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.state === "suspended")
    return NextResponse.json({ error: "suspended" }, { status: 403 });

  const used = await monthlySetsUsed(profile.id);
  if (used >= profile.monthly_set_limit) {
    return NextResponse.json(
      { error: "今月の作成回数の上限に達しました" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const phrases: PhraseItem[] = DEFAULT_PHRASES.map((p) => ({
    no: p.no,
    text: p.text,
    color: p.color,
  }));

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: profile.id,
      answers: { step: 1 },
      phrases,
      status: "draft",
      regen_remaining: profile.regen_limit,
      clothing_remaining: profile.clothing_limit,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[projects.create]", error);
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
