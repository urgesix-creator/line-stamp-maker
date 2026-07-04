import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSettings, computeCostYen, formatYen } from "@/lib/settings";
import { Header, SectionTitle, Footer } from "@/components/ui";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

// S9 利用状況ダッシュボード
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await requireAdmin();
  const { m } = await searchParams;
  const offset = m === "prev" ? -1 : 0;
  const { start, end } = monthRange(offset);
  const db = createAdminClient();

  // 当月の成功生成ログ
  const { data: logs } = await db
    .from("gen_logs")
    .select("user_id,kind,success")
    .eq("success", true)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  const imageLogs = (logs ?? []).filter((l) =>
    ["preview", "main", "regen"].includes(l.kind),
  );
  const clothingLogs = (logs ?? []).filter((l) => l.kind === "clothing");
  const totalImages = imageLogs.length;
  const totalGen = (logs ?? []).length;

  // 当月作成セット数
  const { count: setCount } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  const settings = await getAppSettings();
  const cost = computeCostYen(totalImages, clothingLogs.length, settings);

  // ユーザー別生成回数（多い順）
  const perUser = new Map<string, number>();
  for (const l of logs ?? []) {
    perUser.set(l.user_id, (perUser.get(l.user_id) ?? 0) + 1);
  }
  const { data: profiles } = await db.from("profiles").select("id,display_name,email");
  const nameById = new Map(
    (profiles ?? []).map((p: Pick<Profile, "id" | "display_name" | "email">) => [
      p.id,
      p.display_name || p.email,
    ]),
  );
  const ranking = [...perUser.entries()]
    .map(([uid, n]) => ({ name: nameById.get(uid) ?? "（不明）", count: n }))
    .sort((a, b) => b.count - a.count);

  const monthLabel = `${start.getFullYear()}年${start.getMonth() + 1}月`;
  const isEmpty = totalGen === 0 && (setCount ?? 0) === 0;

  return (
    <div className="container">
      <p>
        <Link href="/admin">← 管理メニューにもどる</Link>
      </p>
      <Header title="📊 利用状況" desc={monthLabel} badge="管理者" />

      <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
        <Link className={`btn btn-sm ${offset === 0 ? "btn-primary" : "btn-outline"}`} href="/admin/dashboard">
          今月
        </Link>
        <Link className={`btn btn-sm ${offset === -1 ? "btn-primary" : "btn-outline"}`} href="/admin/dashboard?m=prev">
          前月
        </Link>
      </div>

      {isEmpty ? (
        <div className="card">
          <p className="text-sub mb-0">今月の利用はまだありません</p>
        </div>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 16 }}>
            <StatCard label="総生成枚数" value={`${totalGen}枚`} />
            <StatCard label="総セット数" value={`${setCount ?? 0}セット`} />
            <StatCard label="概算コスト" value={formatYen(cost)} />
          </div>

          <SectionTitle>ユーザー別 生成回数（多い順）</SectionTitle>
          <div className="card">
            {ranking.length === 0 ? (
              <p className="text-sub mb-0">データがありません</p>
            ) : (
              ranking.map((r, i) => (
                <div className="tip-item row between" key={i}>
                  <strong>{r.name}</strong>
                  <span>{r.count}回</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
      <Footer />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card center" style={{ flex: 1, minWidth: 140 }}>
      <p className="text-sub mb-0">{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)", margin: "6px 0 0" }}>
        {value}
      </p>
    </div>
  );
}
