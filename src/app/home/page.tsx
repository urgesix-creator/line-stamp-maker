import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { remainingSets } from "@/lib/quota";
import { signedStampUrl } from "@/lib/storage";
import { STAMP_RETENTION_DAYS } from "@/lib/constants";
import { Header, StatusBadge, Footer } from "@/components/ui";
import { NewStampButton, WelcomeBanner, DeleteProjectButton } from "./HomeClient";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getThumb(project: Project): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stamp_images")
    .select("storage_path")
    .eq("project_id", project.id)
    .eq("slot", "01")
    .maybeSingle();
  if (!data?.storage_path) return null;
  return signedStampUrl(data.storage_path);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const profile = await requireUser();
  const { welcome } = await searchParams;
  const supabase = await createClient();

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  const projects = (projectsRaw ?? []) as Project[];

  const remaining = await remainingSets(profile.id, profile.monthly_set_limit);
  const atLimit = remaining <= 0;

  // 管理者：承認待ち件数
  let pendingCount = 0;
  if (profile.role === "admin") {
    const admin = createAdminClient();
    const { count } = await admin
      .from("quota_requests")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending");
    pendingCount = count ?? 0;
  }

  const thumbs = await Promise.all(
    projects.map(async (p) => ({ id: p.id, url: await getThumb(p) })),
  );
  const thumbMap = Object.fromEntries(thumbs.map((t) => [t.id, t.url]));

  const now = Date.now();
  function isExpired(p: Project): boolean {
    if (p.status !== "completed" || !p.completed_at) return false;
    const age = now - new Date(p.completed_at).getTime();
    return age > STAMP_RETENTION_DAYS * 24 * 3600 * 1000;
  }

  return (
    <div className="container">
      <Header
        title="🎨 LINEスタンプメーカー"
        desc="しゃしんと5つの質問から、あなただけのスタンプを作れます"
        badge="招待制アプリ"
      />

      {welcome === "1" && (
        <Suspense>
          <WelcomeBanner />
        </Suspense>
      )}

      <div className="card">
        <NewStampButton disabled={atLimit} />
        {atLimit ? (
          <p className="text-sub mt-8">
            今月の作成回数の上限に達しました
            <Link href="/home/request-monthly">追加をお願いする</Link>
          </p>
        ) : (
          <p className="text-sub mt-8">今月あと{remaining}セット作れます</p>
        )}
      </div>

      <h2 className="section-title">🖼 わたしのスタンプ</h2>

      {projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="emoji">🎨</span>
            まだスタンプがありません。上のボタンから作ってみましょう！
          </div>
        </div>
      ) : (
        <div className="stack">
          {projects.map((p) => {
            const expired = isExpired(p);
            const url = thumbMap[p.id];
            return (
              <div className="card project-card" key={p.id}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="project-thumb" />
                ) : (
                  <div className="project-thumb" />
                )}
                <div className="project-meta">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <StatusBadge status={expired ? "expired" : p.status} />
                  </div>
                  <div className="project-date">
                    作成日：
                    {new Date(p.created_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
                <div className="stack" style={{ gap: 8, alignItems: "flex-end" }}>
                  {p.status === "completed" && !expired && (
                    <Link
                      className="btn btn-primary btn-sm"
                      href={`/project/${p.id}/download`}
                    >
                      ダウンロード
                    </Link>
                  )}
                  {p.status !== "completed" && (
                    <Link
                      className="btn btn-outline btn-sm"
                      href={continueHref(p)}
                    >
                      つづきから
                    </Link>
                  )}
                  <DeleteProjectButton projectId={p.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card mt-16">
        <Link href="/guide">📖 使い方ガイド</Link>
      </div>

      {profile.role === "admin" && (
        <div className="card">
          <Link href="/admin" className="row" style={{ gap: 8 }}>
            ⚙ 管理メニュー
            {pendingCount > 0 && (
              <span className="count-badge">{pendingCount}</span>
            )}
          </Link>
        </div>
      )}

      <Footer />
    </div>
  );
}

function continueHref(p: Project): string {
  switch (p.status) {
    case "preview_generating":
    case "preview_review":
      return `/project/${p.id}/preview`;
    case "main_generating":
    case "full_review":
      return `/project/${p.id}/review`;
    default:
      return `/create/${p.id}`;
  }
}
