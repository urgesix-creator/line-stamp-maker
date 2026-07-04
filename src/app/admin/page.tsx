import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSettings } from "@/lib/settings";
import { Header, Footer } from "@/components/ui";
import { AdminClient } from "./AdminClient";
import type { Profile, QuotaRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const db = createAdminClient();

  const [{ data: profiles }, settings, { data: reqs }] = await Promise.all([
    db.from("profiles").select("*").order("created_at", { ascending: false }),
    getAppSettings(),
    db.from("quota_requests").select("*").order("created_at", { ascending: false }),
  ]);

  // 申請者名を解決
  const nameById = new Map(
    (profiles ?? []).map((p: Profile) => [p.id, p.display_name]),
  );
  const requests: QuotaRequest[] = (reqs ?? []).map((r: QuotaRequest) => ({
    ...r,
    requester_name: nameById.get(r.requester_id) ?? "（不明）",
  }));

  const pending = requests.filter((r) => r.state === "pending");
  const history = requests.filter((r) => r.state !== "pending");

  const allUsers = (profiles ?? []) as Profile[];
  // 承認待ちの利用申請（新規ユーザー）
  const pendingUsers = allUsers.filter((u) => u.state === "pending");
  // すでに承認済み（一般・管理者）のユーザー一覧
  const activeUsers = allUsers.filter((u) => u.state !== "pending");

  return (
    <div className="container">
      <p>
        <Link href="/home">← ホームにもどる</Link>
      </p>
      <Header title="⚙ 管理メニュー" desc="利用申請の承認・ユーザー管理・アプリ設定" badge="管理者" />

      <AdminClient
        pendingUsers={pendingUsers}
        pending={pending}
        history={history}
        users={activeUsers}
        settings={settings}
      />

      <div className="card mt-16">
        <Link href="/admin/dashboard">📊 利用状況ダッシュボードを見る</Link>
      </div>
      <Footer />
    </div>
  );
}
