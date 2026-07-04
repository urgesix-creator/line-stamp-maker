"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header, NoteBox } from "@/components/ui";
import { ClothingModal } from "@/components/ClothingModal";
import { useProjectStatus } from "@/lib/useProjectStatus";
import { PREVIEW_NUMBERS } from "@/lib/constants";

export function PreviewClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data, refresh } = useProjectStatus(projectId);
  const [busy, setBusy] = useState(false);
  const [clothingNo, setClothingNo] = useState<number | null>(null);
  const [redoNote, setRedoNote] = useState(false);

  const generating =
    !data || data.status === "preview_generating" || data.status === "draft";
  const imgBySlot = (slot: string) => data?.images.find((i) => i.slot === slot);

  async function proceed() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/generate-remaining`, { method: "POST" });
    router.push(`/project/${projectId}/review`);
  }

  async function redo() {
    // 2回目以降は上限消費の旨を事前表示
    if (data?.redo_used && !redoNote) {
      setRedoNote(true);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/redo`, { method: "POST" });
    if (res.ok) {
      router.push(`/create/${projectId}`);
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <Header
        title="✨ できあがりを見てみましょう"
        desc="まず4枚を作りました。小さくても読めるか確認してください"
        badge="プレビュー確認"
      />

      {/* 残数常時表示 */}
      {data && (
        <p className="center text-sub">
          作り直し あと{data.regen_remaining}回 ／ 服装変更 あと{data.clothing_remaining}回
        </p>
      )}

      {/* LINEトーク画面風背景 */}
      <div className="talk-bg">
        <div className="stamp-grid g4">
          {PREVIEW_NUMBERS.map((no) => {
            const slot = String(no).padStart(2, "0");
            const img = imgBySlot(slot);
            return (
              <div className="stamp-cell" key={no}>
                {img?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" className="stamp-img" />
                ) : (
                  <div className="stamp-img skeleton" />
                )}
                <div className="stamp-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={!img?.url}
                    onClick={() => setClothingNo(no)}
                  >
                    👕 服装を変える
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {generating && (
        <div className="center mt-16">
          <div className="loader" />
          <p>
            スタンプを描いています<span className="dots-loading" />
          </p>
          <p className="text-sub">この画面を閉じても作成は続きます。</p>
        </div>
      )}

      {redoNote && (
        <NoteBox title="ご確認ください">
          やり直しは1セット1回まで無料です。今回は2回目以降のため、作り直し回数を1回消費します。もう一度「雰囲気を変えてやり直す」を押すと実行します。
        </NoteBox>
      )}

      {!generating && (
        <div className="stack mt-24">
          <button
            className="btn btn-outline btn-block"
            onClick={() => router.push(`/project/${projectId}/codex`)}
            disabled={busy}
          >
            Codexで残り12枚を作って取り込む
          </button>
          <button
            className="btn btn-primary btn-block"
            onClick={proceed}
            disabled={busy}
          >
            アプリで残り12枚を自動生成する
          </button>
          <button className="btn btn-outline btn-block" onClick={redo} disabled={busy}>
            雰囲気を変えてやり直す
          </button>
        </div>
      )}

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
