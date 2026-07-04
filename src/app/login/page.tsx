"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header, NoteBox } from "@/components/ui";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = params.get("pending") === "1";
  const suspended = params.get("suspended") === "1";

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "名前かあいことばが違います");
      setLoading(false);
      return;
    }
    router.replace("/home");
    router.refresh();
  }

  return (
    <div className="container narrow">
      <Header
        title="LINEスタンプメーカー"
        desc="承認された方専用のアプリです"
        badge="申請制アプリ"
      />

      {pending && (
        <NoteBox title="承認待ちです">
          管理者の承認をお待ちください。承認されるとログインできます。
        </NoteBox>
      )}
      {suspended && (
        <NoteBox>このアカウントは現在利用できません。管理者にお問い合わせください</NoteBox>
      )}

      <div className="card">
        <form onSubmit={onLogin}>
          {error && <NoteBox>{error}</NoteBox>}
          <div className="field">
            <label htmlFor="name">お名前</label>
            <input
              id="name"
              type="text"
              className="input"
              value={name}
              autoComplete="username"
              onChange={(e) => setName(e.target.value)}
              placeholder="申請したときのお名前"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="passphrase">あいことば</label>
            <input
              id="passphrase"
              type="password"
              className="input"
              value={passphrase}
              autoComplete="current-password"
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="自分で決めたあいことば"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? "ログイン中…" : "ログインする"}
          </button>
        </form>

        <div className="note-box" style={{ marginTop: 20 }}>
          <strong>はじめての方へ</strong>
          名前とあいことばを決めて、管理者に利用を申請できます。
          <div className="mt-8">
            <Link className="btn btn-outline btn-sm" href="/apply">
              ＋ 利用を申請する
            </Link>
          </div>
        </div>
      </div>

      <p className="center" style={{ fontSize: 13, color: "var(--text-sub)" }}>
        あいことばを忘れたときは、管理者にお問い合わせください
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container narrow" />}>
      <LoginInner />
    </Suspense>
  );
}
