import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// アプリ設定の更新（S8 セクション4）：単価・費用文言・案内テンプレ・招待メッセージ。
export async function PATCH(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const k of [
    "price_per_image",
    "price_per_clothing",
    "cost_message",
    "invite_template",
    "invite_message",
  ]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "変更内容がありません" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("app_settings").update(patch).eq("id", 1);
  if (error) {
    console.error("[admin.settings]", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
