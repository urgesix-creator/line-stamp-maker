"use client";

import { useState } from "react";
import { CLOTHING_CHIPS } from "@/lib/constants";
import { NoteBox } from "./ui";
import { RequestModal } from "./RequestModal";

// 服装変更モーダル（F9）。上限到達時は申請モードに切替。
export function ClothingModal({
  projectId,
  no,
  imageUrl,
  remaining,
  isPending,
  onClose,
  onChanged,
}: {
  projectId: string;
  no: number;
  imageUrl: string | null;
  remaining: number;
  isPending: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 上限到達 → 申請モーダル（F10）
  if (remaining <= 0) {
    return (
      <RequestModal
        projectId={projectId}
        kind="clothing"
        kindLabel="服装変更"
        isPending={isPending}
        onClose={onClose}
      />
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/clothing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ no, instruction }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.message ?? json.error ?? "変更に失敗しました");
      return;
    }
    onChanged();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>👕 服装を変える</h2>
        <p className="text-sub">残り {remaining} 回</p>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{
              width: "100%",
              maxWidth: 200,
              display: "block",
              margin: "0 auto 12px",
              background: "#dcf0f8",
              borderRadius: 10,
            }}
          />
        )}

        {loading ? (
          <div className="center">
            <div className="loader" />
            <p>服装を描き変えています<span className="dots-loading" /></p>
          </div>
        ) : (
          <>
            <div className="field">
              <label>どんな服装にしますか？</label>
              <textarea
                className="textarea"
                placeholder="例：青いパーカーとジーンズに変えてください"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {CLOTHING_CHIPS.map((c) => (
                <button
                  key={c}
                  className="btn btn-outline btn-sm"
                  onClick={() => setInstruction((cur) => (cur ? cur + " " : "") + c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <NoteBox title="文字の確認をお願いします">
              服装を変えると、まれに文字が崩れることがあります。変更後は文字が正しいか確認してください。
            </NoteBox>

            {error && <p className="field-error">{error}</p>}

            <div className="row mt-16" style={{ gap: 12 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                とじる
              </button>
              <button
                className="btn btn-primary btn-block"
                onClick={submit}
                disabled={!instruction.trim()}
              >
                この服装で作り直す
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
