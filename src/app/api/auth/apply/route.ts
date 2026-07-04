import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalEmail, normalizeName, isNameTaken } from "@/lib/account";
import { sendMail } from "@/lib/email";

// 利用申請（F1改）。名前＋あいことばで申請 → 承認待ち(pending)ユーザーを作成。
// 管理者が承認して回数を付与するまで利用不可。
export async function POST(req: Request) {
  const { name: rawName, passphrase, consent } = await req.json();
  const name = normalizeName(rawName);

  if (!name) return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  if (!passphrase || passphrase.length < 4)
    return NextResponse.json(
      { error: "あいことばは4文字以上で入力してください" },
      { status: 400 },
    );
  if (!consent)
    return NextResponse.json({ error: "同意が必要です" }, { status: 400 });

  if (await isNameTaken(name))
    return NextResponse.json(
      { error: "この名前はすでに使われています。別の名前にしてください" },
      { status: 409 },
    );

  const admin = createAdminClient();
  const email = internalEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: passphrase,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error || !data.user) {
    console.error("[apply]", error);
    return NextResponse.json({ error: "申請に失敗しました。しばらくしてお試しください" }, { status: 500 });
  }

  // 承認待ち・回数0で作成（トリガーが作った行を上書き）
  await admin
    .from("profiles")
    .update({ state: "pending", monthly_set_limit: 0, email })
    .eq("id", data.user.id);

  // 管理者へ通知
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_INITIAL_EMAIL || "";
  if (adminEmail) {
    await sendMail({
      to: adminEmail,
      subject: "【スタンプメーカー】新しい利用申請が届いています",
      text: [
        `「${name}」さんから利用申請が届きました。`,
        "",
        `管理画面で承認（回数を指定）できます: ${process.env.NEXT_PUBLIC_APP_URL || ""}/admin`,
      ].join("\n"),
    });
  }

  return NextResponse.json({ ok: true });
}
