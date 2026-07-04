"use client";

import { useState } from "react";
import { NoteBox } from "./ui";
import type { RequestKind } from "@/lib/constants";

// 追加枠申請モーダル（F10）。申請中は重複不可・ボタン無効。
export function RequestModal({
  projectId,
  kind,
  kindLabel,
  isPending,
  onClose,
}: {
  projectId: string;
  kind: RequestKind;
  kindLabel: string;
  isPending: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(isPending);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, reason }),
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>追加のお願い（{kindLabel}）</h2>

        {done ? (
          <div className="success-box">
            申請を送りました。管理者の承認をお待ちください。
          </div>
        ) : pending ? (
          <NoteBox>申請中です（管理者の承認待ち）</NoteBox>
        ) : (
          <>
            <NoteBox title="回数上限に達しました">
              追加したい場合は、管理者に申請できます。
            </NoteBox>
            <div className="field">
              <label>申請理由（任意・200字まで）</label>
              <textarea
                className="textarea"
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例：もう少し表情を調整したいです"
              />
            </div>
            {error && <p className="field-error">{error}</p>}
          </>
        )}

        <div className="row mt-16" style={{ gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            とじる
          </button>
          {!done && !pending && (
            <button
              className="btn btn-primary btn-block"
              onClick={submit}
              disabled={loading}
            >
              {loading ? "送信中…" : "追加をお願いする"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
