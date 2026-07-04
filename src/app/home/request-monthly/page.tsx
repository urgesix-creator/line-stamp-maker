import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/ui";
import { MonthlyRequestClient } from "./MonthlyRequestClient";

export const dynamic = "force-dynamic";

// S3「追加をお願いする」→ 月間セット枠の申請（F10）
export default async function RequestMonthlyPage() {
  const profile = await requireUser();
  const db = createAdminClient();
  const { data: pending } = await db
    .from("quota_requests")
    .select("id")
    .eq("requester_id", profile.id)
    .eq("kind", "monthly")
    .eq("state", "pending")
    .maybeSingle();

  return (
    <div className="container narrow">
      <Header title="＋ 追加のお願い" desc="今月のセット作成回数を増やしたいとき" badge="申請" />
      <div className="card">
        <MonthlyRequestClient alreadyPending={!!pending} />
      </div>
    </div>
  );
}
