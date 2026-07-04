import { Resend } from "resend";

// ─────────────────────────────────────────────────────────────
// メール送信の抽象化（F10 追加枠申請の管理者通知）
// RESEND_API_KEY が未設定の場合はログ出力にフォールバックする。
// ─────────────────────────────────────────────────────────────

export interface MailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(input: MailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "LINEスタンプメーカー <noreply@example.com>";

  if (!apiKey) {
    // フォールバック：メールプロバイダ未設定時はサーバーログに内容を出す
    console.log(
      `[MAIL:fallback] to=${input.to} subject=${input.subject}\n${input.text}`,
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (e) {
    // 通知失敗は本処理をブロックしない（申請自体は成立させる）
    console.error("[MAIL:error]", e);
  }
}

/** 追加枠申請の管理者通知（F10） */
export async function notifyQuotaRequest(params: {
  adminEmail: string;
  requesterName: string;
  kindLabel: string;
  reason?: string | null;
  appUrl: string;
}): Promise<void> {
  const { adminEmail, requesterName, kindLabel, reason, appUrl } = params;
  await sendMail({
    to: adminEmail,
    subject: "【スタンプメーカー】追加枠の申請が届いています",
    text: [
      `${requesterName} さんから「${kindLabel}」の追加枠の申請が届きました。`,
      reason ? `申請理由: ${reason}` : "（申請理由の記入はありません）",
      "",
      `管理画面で承認・却下できます: ${appUrl}/admin`,
    ].join("\n"),
  });
}
