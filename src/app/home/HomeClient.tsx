"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// S3 新規作成ボタン：プロジェクトを作成してウィザードへ。
export function NewStampButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "作成に失敗しました");
      setLoading(false);
      return;
    }
    router.push(`/create/${json.id}`);
  }

  return (
    <>
      <button
        className="btn btn-primary btn-block"
        onClick={create}
        disabled={disabled || loading}
      >
        {loading ? "準備中…" : "＋ 新しいスタンプを作る"}
      </button>
      {error && <p className="field-error">{error}</p>}
    </>
  );
}

// スタンプ（プロジェクト）の削除ボタン。写真・生成画像もすべて削除する。
export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function del() {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setLoading(false);
      setConfirming(false);
      alert("削除に失敗しました。しばらくしてお試しください。");
    }
  }

  if (!confirming) {
    return (
      <button
        className="btn btn-danger btn-sm"
        onClick={() => setConfirming(true)}
        aria-label="このスタンプを削除する"
      >
        🗑 削除
      </button>
    );
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="text-sub" style={{ fontSize: 12 }}>
        写真もスタンプも消えます。よろしいですか？
      </span>
      <div className="row" style={{ gap: 6 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          やめる
        </button>
        <button className="btn btn-danger btn-sm" onClick={del} disabled={loading}>
          {loading ? "削除中…" : "削除する"}
        </button>
      </div>
    </div>
  );
}

// S2からの初回案内バナー（📖 はじめてガイドを見る／あとで見る）
export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="success-box">
      <strong>登録が完了しました！さっそくスタンプを作ってみましょう</strong>
      <div className="row wrap mt-8" style={{ gap: 8 }}>
        <Link className="btn btn-primary btn-sm" href="/guide">
          📖 はじめてガイドを見る
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={() => setDismissed(true)}>
          あとで見る
        </button>
      </div>
    </div>
  );
}
