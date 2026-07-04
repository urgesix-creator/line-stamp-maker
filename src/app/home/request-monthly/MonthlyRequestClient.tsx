"use client";

import { useState } from "react";
import Link from "next/link";
import { NoteBox, SuccessBox } from "@/components/ui";

export function MonthlyRequestClient({ alreadyPending }: { alreadyPending: boolean }) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(alreadyPending);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/requests/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.status === 409) {
      setPending(true);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "申請に失敗しました");
      return;
    }
    setDone(true);
    setPending(true);
  }

  if (done)
    return (
      <>
        <SuccessBox>申請を送りました。管理者の承認をお待ちください。</SuccessBox>
        <Link className="btn btn-primary btn-block" href="/home">
          ホームにもどる
        </Link>
      </>
    );

  if (pending)
    return (
      <>
        <NoteBox>申請中です（管理者の承認待ち）</NoteBox>
        <Link className="btn btn-outline btn-block" href="/home">
          ホームにもどる
        </Link>
      </>
    );

  return (
    <>
      <NoteBox title="今月の作成回数の上限に達しました">
        追加したい場合は、管理者に申請できます。
      </NoteBox>
      <div className="field">
        <label>申請理由（任意・200字まで）</label>
        <textarea
          className="textarea"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例：家族の分も作りたいです"
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="row" style={{ gap: 12 }}>
        <Link className="btn btn-ghost" href="/home">
          もどる
        </Link>
        <button className="btn btn-primary btn-block" onClick={submit} disabled={loading}>
          {loading ? "送信中…" : "追加をお願いする"}
        </button>
      </div>
    </>
  );
}
