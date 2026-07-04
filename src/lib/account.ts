import { randomBytes } from "crypto";
import { createAdminClient } from "./supabase/admin";

// ─────────────────────────────────────────────────────────────
// 名前ベースのアカウント補助（メール非使用・F1改）
// Supabase Authはメール必須のため、内部的に見えないメールを合成して使う。
// 利用者・管理者の画面にメールは一切出さない。
// ─────────────────────────────────────────────────────────────

/** 内部用の合成メール（利用者には見せない） */
export function internalEmail(): string {
  return `u_${randomBytes(12).toString("hex")}@stamp.local`;
}

/** 表示名の正規化（前後空白を除去） */
export function normalizeName(name: string): string {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

/** その表示名が既に使われているか（大文字小文字・全半角無視の簡易判定） */
export async function isNameTaken(name: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("display_name", name)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** 表示名からログイン用の内部メールを引く（ログイン時に使用） */
export async function emailForName(name: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .ilike("display_name", name)
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}
