"use client";

import { useState } from "react";
import Link from "next/link";
import { Header, NoteBox, SuccessBox } from "@/components/ui";

// 利用申請ページ（F1改）。名前＋あいことばを決めて管理者に申請する。
export default function ApplyPage() {
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("名前を入力してください");
    if (passphrase.length < 4) return setError("あいことばは4文字以上で入力してください");
    if (passphrase !== confirm) return setError("あいことば（確認用）が一致しません");
    if (!consent) return setError("同意のチェックが必要です");

    setLoading(true);
    const res = await fetch("/api/auth/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, passphrase, consent }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "申請に失敗しました");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="container narrow">
        <Header title="申請しました 🎉" badge="申請制アプリ" />
        <div className="card">
          <SuccessBox title="申請を送りました">
            管理者が承認すると使えるようになります。承認されたら、決めた
            <strong>お名前</strong>と<strong>あいことば</strong>でログインしてください。
          </SuccessBox>
          <Link className="btn btn-primary btn-block" href="/login">
            ログイン画面へ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <Header
        title="ようこそ！🎉"
        desc="お名前とあいことばを決めて、利用を申請しましょう"
        badge="申請制アプリ"
      />
      <div className="card">
        <form onSubmit={onSubmit}>
          {error && <NoteBox>{error}</NoteBox>}
          <div className="field">
            <label htmlFor="name">お名前</label>
            <input
              id="name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：田中はなこ"
              required
            />
            <p className="hint">ログインのときに使います。他の人と同じ名前は使えません。</p>
          </div>
          <div className="field">
            <label htmlFor="passphrase">あいことば</label>
            <input
              id="passphrase"
              type="password"
              className="input"
              value={passphrase}
              autoComplete="new-password"
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
            <p className="hint">4文字以上。ログインのときに使う、あなただけの合言葉です。</p>
          </div>
          <div className="field">
            <label htmlFor="confirm">あいことば（確認用）</label>
            <input
              id="confirm"
              type="password"
              className="input"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="row" style={{ fontWeight: 400, cursor: "pointer", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2 }}
              />
              <span className="text-sub">
                アップロードした写真はスタンプ生成にのみ使用し、期間経過後に削除されることに同意します
              </span>
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "申請中…" : "管理者に申請する"}
          </button>
        </form>
      </div>
      <p className="center">
        <Link href="/login">← ログイン画面にもどる</Link>
      </p>
    </div>
  );
}
