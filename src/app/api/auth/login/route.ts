import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeName, emailForName } from "@/lib/account";

// 名前＋あいことばログイン（F1改）。メールは内部的に解決し、画面には出さない。
// アカウント有無を漏らさないため、失敗時は常に同一文言を返す。
export async function POST(req: Request) {
  const { name: rawName, passphrase } = await req.json();
  const name = normalizeName(rawName);
  const GENERIC = { error: "名前かあいことばが違います" };

  if (!name || !passphrase)
    return NextResponse.json(GENERIC, { status: 400 });

  const email = await emailForName(name);
  if (!email) return NextResponse.json(GENERIC, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: passphrase,
  });
  if (error || !data.user) return NextResponse.json(GENERIC, { status: 400 });

  // 状態チェック（承認待ち・停止中は入れない）
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("state")
    .eq("id", data.user.id)
    .single();

  if (profile?.state === "pending") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { pending: true, error: "まだ承認されていません（管理者の承認待ち）" },
      { status: 403 },
    );
  }
  if (profile?.state === "suspended") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { suspended: true, error: "このアカウントは現在利用できません。管理者にお問い合わせください" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
