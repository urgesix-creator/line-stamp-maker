"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyBlock } from "@/components/CopyBlock";
import { NoteBox } from "@/components/ui";
import type { ManualStampPhase } from "@/lib/codex";

type SelectedFiles = Record<string, File | null>;

function slotName(no: number) {
  return String(no).padStart(2, "0");
}

export function CodexImportClient({
  projectId,
  phase,
  slots,
  promptText,
  existingSlots,
}: {
  projectId: string;
  phase: ManualStampPhase;
  slots: number[];
  promptText: string;
  existingSlots: string[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<SelectedFiles>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => slots.filter((no) => files[slotName(no)]).length,
    [files, slots],
  );
  const allSelected = selectedCount === slots.length;
  const nextPath =
    phase === "preview" ? `/project/${projectId}/preview` : `/project/${projectId}/review`;

  function setFile(slot: string, file: File | null) {
    setFiles((current) => ({ ...current, [slot]: file }));
  }

  async function upload() {
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("phase", phase);
    for (const no of slots) {
      const slot = slotName(no);
      const file = files[slot];
      if (file) form.append(`slot-${slot}`, file);
    }

    const res = await fetch(`/api/projects/${projectId}/manual-stamps`, {
      method: "POST",
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "取り込みに失敗しました");
      return;
    }
    router.push(nextPath);
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>1. Codexに渡す制作指示</h2>
        <p className="text-sub">
          下の内容をCodexに貼り付けて、文字入りの完成画像として作成してください。
        </p>
        <CopyBlock
          label="Codex制作指示"
          text={promptText}
          footNote="画像生成後、文字が正確な画像だけを下でアップロードします"
        />
      </div>

      <div className="card">
        <h2>2. 生成したPNGを取り込む</h2>
        <NoteBox title="取り込み前の確認">
          日本語文字が正確で、文字とキャラが重なっていない画像だけを選んでください。
          背景は透過PNG、またはシアン単色背景のPNGを推奨します。
        </NoteBox>

        <div className="stack mt-16">
          {slots.map((no) => {
            const slot = slotName(no);
            const selected = files[slot];
            const alreadySaved = existingSlots.includes(slot);
            return (
              <div className="tip-item" key={slot}>
                <div className="row between wrap" style={{ gap: 10 }}>
                  <div>
                    <strong>{slot}.png</strong>
                    {alreadySaved && (
                      <span className="status-badge done" style={{ marginLeft: 8 }}>
                        取込済み
                      </span>
                    )}
                    <p className="text-sub" style={{ margin: 0, fontSize: 13 }}>
                      {selected ? selected.name : "画像を選んでください"}
                    </p>
                  </div>
                  <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                    PNGを選ぶ
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) =>
                        setFile(slot, event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="field-error">{error}</p>}
        <button
          className="btn btn-primary btn-block mt-16"
          disabled={!allSelected || loading}
          onClick={upload}
        >
          {loading
            ? "取り込み中…"
            : `${slots[0]}〜${slots[slots.length - 1]}番を取り込む`}
        </button>
        <p className="text-sub mt-8">
          選択済み：{selectedCount} / {slots.length}
        </p>
      </div>
    </div>
  );
}
