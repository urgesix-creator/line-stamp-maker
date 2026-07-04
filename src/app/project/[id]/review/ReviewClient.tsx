"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header, NoteBox } from "@/components/ui";
import { ClothingModal } from "@/components/ClothingModal";
import { RequestModal } from "@/components/RequestModal";
import { Confetti } from "@/components/Confetti";
import { useProjectStatus } from "@/lib/useProjectStatus";
import { IMAGE_NUMBERS } from "@/lib/constants";
import type { PhraseItem } from "@/lib/types";

export function ReviewClient({
  projectId,
  phrases,
}: {
  projectId: string;
  phrases: PhraseItem[];
}) {
  const router = useRouter();
  const { data, refresh } = useProjectStatus(projectId);
  const [clothingNo, setClothingNo] = useState<number | null>(null);
  const [regenNo, setRegenNo] = useState<number | null>(null);
  const [regenLimitOpen, setRegenLimitOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const imgBySlot = (slot: string) => data?.images.find((i) => i.slot === slot);
  const phraseOf = (no: number) => phrases.find((p) => p.no === no)?.text ?? "";

  const numbered = (data?.images ?? []).filter((i) => /^\d\d$/.test(i.slot));
  const allGenerated = numbered.length >= 16;
  const allOk = allGenerated && numbered.every((i) => i.review_state === "ok");

  async function setOk(no: number) {
    await fetch(`/api/projects/${projectId}/review-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ no, ok: true }),
    });
    refresh();
  }

  async function confirmAll() {
    // 全16枚OK確定の瞬間：紙吹雪→完成化→S7へ
    setConfetti(true);
    setFinalizing(true);
    const res = await fetch(`/api/projects/${projectId}/complete`, { method: "POST" });
    if (res.ok) {
      setTimeout(() => router.push(`/project/${projectId}/download`), 1700);
    } else {
      setFinalizing(false);
      setConfetti(false);
    }
  }

  return (
    <div className="container">
      <Header
        title="🖼 ぜんぶ確認しましょう"
        desc="16枚のスタンプができました。1枚ずつ確認してください"
        badge="全16枚確認"
      />

      {data && (
        <p className="center text-sub">
          作り直し あと{data.regen_remaining}回 ／ 服装変更 あと{data.clothing_remaining}回
        </p>
      )}

      <NoteBox title="文字が正しいか、1枚ずつ確認してください">
        まちがった文字は、AIの生成でまれに起こることがあります。
      </NoteBox>

      <div className="stamp-grid g16">
        {IMAGE_NUMBERS.map((no) => {
          const slot = String(no).padStart(2, "0");
          const img = imgBySlot(slot);
          const isOk = img?.review_state === "ok";
          return (
            <div className="stamp-cell" key={no}>
              {img?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={phraseOf(no)} className="stamp-img" />
              ) : (
                <div className="stamp-img skeleton" />
              )}
              {!img?.url && (
                <p className="text-sub" style={{ fontSize: 12 }}>
                  描いています…
                </p>
              )}
              {img?.url && (
                <>
                  {isOk && <p className="status-badge done" style={{ fontSize: 11 }}>OK</p>}
                  <div className="stamp-actions">
                    <button
                      className={`btn btn-sm ${isOk ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setOk(no)}
                    >
                      ✓ OK
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        (data?.regen_remaining ?? 0) <= 0
                          ? setRegenLimitOpen(true)
                          : setRegenNo(no)
                      }
                    >
                      ↻ 作り直す
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setClothingNo(no)}
                    >
                      👕 服装
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 完成バー（全16枚OK時に出現） */}
      {allOk && !finalizing && (
        <div className="sticky-bar">
          <button className="btn btn-primary btn-block" onClick={confirmAll}>
            すべてOK！ダウンロードへすすむ
          </button>
        </div>
      )}

      {confetti && <Confetti onDone={() => setConfetti(false)} />}
      {finalizing && (
        <div className="center mt-16">
          <div className="loader" />
          <p>仕上げをしています<span className="dots-loading" /></p>
        </div>
      )}

      {/* 作り直しモーダル（理由選択） */}
      {regenNo !== null && data && (
        <RegenModal
          projectId={projectId}
          no={regenNo}
          remaining={data.regen_remaining}
          isPending={data.pendingKinds.includes("regen")}
          onClose={() => setRegenNo(null)}
          onLimit={() => {
            setRegenNo(null);
            setRegenLimitOpen(true);
          }}
          onDone={refresh}
        />
      )}

      {regenLimitOpen && (
        <RequestModal
          projectId={projectId}
          kind="regen"
          kindLabel="再生成（作り直し）"
          isPending={data?.pendingKinds.includes("regen") ?? false}
          onClose={() => setRegenLimitOpen(false)}
        />
      )}

      {/* 服装変更モーダル */}
      {clothingNo !== null && data && (
        <ClothingModal
          projectId={projectId}
          no={clothingNo}
          imageUrl={imgBySlot(String(clothingNo).padStart(2, "0"))?.url ?? null}
          remaining={data.clothing_remaining}
          isPending={data.pendingKinds.includes("clothing")}
          onClose={() => setClothingNo(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// 作り直しモーダル（理由選択→該当1枚のみ再生成）
function RegenModal({
  projectId,
  no,
  remaining,
  isPending,
  onClose,
  onLimit,
  onDone,
}: {
  projectId: string;
  no: number;
  remaining: number;
  isPending: boolean;
  onClose: () => void;
  onLimit: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("文字が間違っている");
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no,
        reason: reason === "その他" ? freeText : reason,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.status === 403) {
      onLimit();
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "作り直しに失敗しました");
      return;
    }
    onDone();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>↻ 作り直す</h2>
        <p className="text-sub">残り {remaining} 回。理由を選んでください。</p>
        {isPending && <NoteBox>追加申請中です（管理者の承認待ち）</NoteBox>}
        {loading ? (
          <div className="center">
            <div className="loader" />
            <p>描き直しています<span className="dots-loading" /></p>
          </div>
        ) : (
          <>
            {["文字が間違っている", "表情を変えたい", "その他"].map((r) => (
              <label
                key={r}
                className="row"
                style={{ cursor: "pointer", padding: "6px 0" }}
              >
                <input
                  type="radio"
                  name="reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
            {reason === "その他" && (
              <textarea
                className="textarea"
                placeholder="どう直したいか教えてください"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
              />
            )}
            {error && <p className="field-error">{error}</p>}
            <div className="row mt-16" style={{ gap: 12 }}>
              <button className="btn btn-ghost" onClick={onClose}>
                とじる
              </button>
              <button className="btn btn-primary btn-block" onClick={submit}>
                この1枚を作り直す
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
