import { createAdminClient } from "./supabase/admin";

// ─────────────────────────────────────────────────────────────
// 上限管理（F8）。月間セット数は当月に作成したプロジェクト数で数える。
// ─────────────────────────────────────────────────────────────

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/** 当月に作成したセット数 */
export async function monthlySetsUsed(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte("created_at", monthStart());
  return count ?? 0;
}

/** 当月あと何セット作れるか */
export async function remainingSets(
  userId: string,
  monthlyLimit: number,
): Promise<number> {
  const used = await monthlySetsUsed(userId);
  return Math.max(0, monthlyLimit - used);
}
