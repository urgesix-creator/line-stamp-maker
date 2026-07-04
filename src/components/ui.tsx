import React from "react";

// ── 共通の表示部品（サーバー/クライアント両用の純粋な見た目コンポーネント） ──

export function Header({
  title,
  desc,
  badge,
}: {
  title: string;
  desc?: string;
  badge?: string;
}) {
  return (
    <header className="header">
      {badge && <span className="badge">{badge}</span>}
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function NoteBox({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="note-box">
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function SuccessBox({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="success-box">
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

export function Footer() {
  return (
    <footer className="footer">
      <p>
        LINEスタンプメーカー（招待制アプリ）
        <br />
        申請代行・審査通過の保証は本アプリの対象外です。
      </p>
    </footer>
  );
}

export function StatusBadge({
  status,
}: {
  status: "draft" | "preview_review" | "full_review" | "completed" | "expired" | string;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "下書き", cls: "" },
    preview_generating: { label: "プレビュー生成中", cls: "" },
    preview_review: { label: "プレビュー確認中", cls: "" },
    main_generating: { label: "本生成中", cls: "" },
    full_review: { label: "全枚確認中", cls: "" },
    completed: { label: "完成", cls: "done" },
    expired: { label: "保存期間終了", cls: "expired" },
  };
  const s = map[status] ?? { label: status, cls: "" };
  return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
}
