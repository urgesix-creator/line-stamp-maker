"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NoteBox } from "@/components/ui";
import {
  WIZARD_TARGETS,
  WIZARD_RESEMBLANCE,
  WIZARD_MOOD,
  WIZARD_TEXT_STYLE,
  WIZARD_PHOTO_FEATURE_FIELDS,
  COLOR_CHIPS,
} from "@/lib/constants";
import type { PhraseItem, WizardAnswers } from "@/lib/types";

const TOTAL_STEPS = 7;

type Photo = { id: string; url: string };

export function WizardClient({
  projectId,
  initialAnswers,
  initialPhrases,
  initialPhotos,
}: {
  projectId: string;
  initialAnswers: WizardAnswers;
  initialPhrases: PhraseItem[];
  initialPhotos: Photo[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(initialAnswers.step ?? 1);
  const [answers, setAnswers] = useState<WizardAnswers>(() => {
    const defaults: WizardAnswers = {
      target: "",
      portraitConsent: false,
      hasPhoto: true,
      resemblance: "caricature",
      mood: "",
      textStyle: "handwritten",
      features: {},
    };
    return { ...defaults, ...initialAnswers };
  });
  const [phrases, setPhrases] = useState<PhraseItem[]>(initialPhrases);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 自動保存（F2）。変更をデバウンスしてPATCH。
  const save = useCallback(
    (a: WizardAnswers, p: PhraseItem[], curStep: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: { ...a, step: curStep }, phrases: p }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 800);
      }, 500);
    },
    [projectId],
  );

  useEffect(() => {
    save(answers, phrases, step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, phrases, step]);

  function update(patch: Partial<WizardAnswers>) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  function goNext() {
    setStep((s) => Math.min(TOTAL_STEPS + 1, s + 1)); // +1 は最終確認
  }
  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  // ── バリデーション（各ステップの進行可否） ──
  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!answers.target;
      case 2:
        return answers.portraitConsent === true;
      case 3:
        if (answers.hasPhoto) return photos.length >= 1;
        // 写真なし：5項目のうち少なくとも1つ入力
        return Object.values(answers.features ?? {}).some((v) => (v ?? "").trim());
      case 4:
        return !!answers.resemblance;
      case 5:
        return !!answers.mood;
      case 6:
        return !!answers.textStyle;
      case 7:
        return true;
      default:
        return true;
    }
  }

  async function startGeneration() {
    setGenerating(true);
    setGenError(null);
    const res = await fetch(`/api/projects/${projectId}/generate-preview`, {
      method: "POST",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setGenError(json.error ?? "生成に失敗しました。回数は消費されていません。");
      setGenerating(false);
      return;
    }
    router.push(`/project/${projectId}/preview`);
  }

  const isFinal = step === TOTAL_STEPS + 1;

  return (
    <div className="container">
      {/* 進捗 */}
      <div className="progress-dots">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`dot ${i + 1 <= Math.min(step, TOTAL_STEPS) ? "active" : ""}`}
          />
        ))}
      </div>
      <div className="row between">
        <span className="step-indicator" style={{ margin: 0 }}>
          {isFinal ? "最終確認" : `ステップ ${step} / ${TOTAL_STEPS}`}
        </span>
        <span className={`autosave ${saved ? "saved" : ""}`}>
          <span className="check">✓</span> 自動保存されています
        </span>
      </div>

      {/* ── 各ステップ ── */}
      {!isFinal && (
        <div className="card mt-16">
          {step === 1 && (
            <Step1 value={answers.target} onSelect={(v) => { update({ target: v }); setTimeout(goNext, 150); }} />
          )}
          {step === 2 && (
            <Step2
              checked={answers.portraitConsent}
              onChange={(v) => update({ portraitConsent: v })}
            />
          )}
          {step === 3 && (
            <Step3
              answers={answers}
              photos={photos}
              projectId={projectId}
              setPhotos={setPhotos}
              update={update}
            />
          )}
          {step === 4 && (
            <Step4 value={answers.resemblance} onSelect={(v) => update({ resemblance: v })} />
          )}
          {step === 5 && (
            <Step5 value={answers.mood} onSelect={(v) => update({ mood: v })} />
          )}
          {step === 6 && (
            <Step6 value={answers.textStyle} onSelect={(v) => update({ textStyle: v })} />
          )}
          {step === 7 && <Step7 phrases={phrases} setPhrases={setPhrases} />}
        </div>
      )}

      {/* ── 最終確認 ── */}
      {isFinal && (
        <div className="card mt-16">
          <h2>✨ 最終確認</h2>
          <SummaryRow label="だれの" value={labelOf(WIZARD_TARGETS, answers.target)} />
          <SummaryRow
            label="写真"
            value={answers.hasPhoto ? `${photos.length}枚アップ` : "写真なし（特徴入力）"}
          />
          <SummaryRow label="似せ度" value={labelOf(WIZARD_RESEMBLANCE, answers.resemblance)} />
          <SummaryRow label="雰囲気" value={labelOf(WIZARD_MOOD, answers.mood)} />
          <SummaryRow label="文字" value={labelOf(WIZARD_TEXT_STYLE, answers.textStyle)} />

          {generating ? (
            <div className="center mt-24">
              <div className="loader" />
              <p>
                スタンプを描いています<span className="dots-loading" /> 1〜4枚目
              </p>
              <p className="text-sub">
                1〜2分かかります。この画面を閉じても作成は続きます。
              </p>
            </div>
          ) : (
            <>
              {genError && (
                <NoteBox title="生成に失敗しました">
                  {genError}
                  <div className="mt-8">
                    <button className="btn btn-outline btn-sm" onClick={startGeneration}>
                      もう一度お試しください
                    </button>
                  </div>
                </NoteBox>
              )}
              <NoteBox title="Codex品質で作る場合">
                画像生成だけをCodexで行い、完成PNGをこのアプリへ取り込みます。文字の正確さを確認しながら作れるため、品質を優先する場合はこちらを使います。
              </NoteBox>
              <button
                className="btn btn-outline btn-block mt-16"
                onClick={() => router.push(`/project/${projectId}/codex`)}
              >
                Codexで4枚を作って取り込む
              </button>
              <button
                className="btn btn-primary btn-block mt-16"
                onClick={startGeneration}
              >
                まず4枚つくる（1〜2分かかります）
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 下部固定：もどる・つぎへ ── */}
      {!generating && (
        <div className="sticky-bar">
          <button className="btn btn-ghost" onClick={step === 1 ? () => router.push("/home") : goBack}>
            もどる
          </button>
          {!isFinal && step !== 1 && (
            <button
              className="btn btn-primary btn-block"
              onClick={goNext}
              disabled={!canProceed()}
            >
              つぎへ
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 補助 ──
function labelOf(
  list: readonly { value: string; label: string }[],
  value: string,
): string {
  return list.find((x) => x.value === value)?.label ?? "-";
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row between tip-item">
      <span className="text-sub">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ── ステップ1 ──
function Step1({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  return (
    <>
      <h2>だれのスタンプを作りますか？</h2>
      <div className="select-grid mt-16">
        {WIZARD_TARGETS.map((t) => (
          <button
            key={t.value}
            className={`select-card ${value === t.value ? "selected" : ""}`}
            onClick={() => onSelect(t.value)}
          >
            <span className="sc-emoji">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── ステップ2 ──
function Step2({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <>
      <h2>肖像権の確認</h2>
      <p className="text-sub">スタンプにする人について確認させてください。</p>
      <label className="row mt-16" style={{ cursor: "pointer", alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 22, height: 22, marginTop: 2 }}
        />
        <strong>はい、本人か、許可をもらった人です</strong>
      </label>
      <div className="note-box">
        有名人や許可のない他人の写真は使えません。
      </div>
    </>
  );
}

// ── ステップ3 ──
function Step3({
  answers,
  photos,
  projectId,
  setPhotos,
  update,
}: {
  answers: WizardAnswers;
  photos: Photo[];
  projectId: string;
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  update: (p: Partial<WizardAnswers>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setErr(null);
    for (const file of files) {
      if (photos.length >= 3) break;
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "アップロードに失敗しました");
      } else {
        setPhotos((ps) => [...ps, { id: json.id, url: json.url }]);
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: id }),
    });
    setPhotos((ps) => ps.filter((p) => p.id !== id));
  }

  return (
    <>
      <h2>写真はありますか？</h2>
      <div className="row wrap mt-8" style={{ gap: 8 }}>
        <button
          className={`btn btn-sm ${answers.hasPhoto ? "btn-primary" : "btn-outline"}`}
          onClick={() => update({ hasPhoto: true })}
        >
          写真をアップする（1〜3枚）
        </button>
        <button
          className={`btn btn-sm ${!answers.hasPhoto ? "btn-primary" : "btn-outline"}`}
          onClick={() => update({ hasPhoto: false })}
        >
          写真なしで特徴を入力する
        </button>
      </div>

      {answers.hasPhoto ? (
        <div className="mt-16">
          <p className="text-sub">
            正面を向いた明るい顔写真がおすすめです（JPG / PNG / HEIC、1枚10MBまで）。
          </p>
          <div className="row wrap mt-8" style={{ gap: 10 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10 }}
                />
                <button
                  className="btn btn-danger btn-sm"
                  style={{ position: "absolute", top: -8, right: -8, minHeight: 28, padding: "2px 8px" }}
                  onClick={() => remove(p.id)}
                >
                  削除
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <label className="btn btn-outline" style={{ cursor: "pointer" }}>
                {uploading ? "アップ中…" : "＋ 写真を選ぶ"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                  multiple
                  hidden
                  onChange={onFile}
                />
              </label>
            )}
          </div>
          {err && <p className="field-error">{err}</p>}
        </div>
      ) : (
        <div className="mt-16">
          {WIZARD_PHOTO_FEATURE_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input
                className="input"
                placeholder={f.placeholder}
                value={(answers.features?.[f.key as keyof typeof answers.features] as string) ?? ""}
                onChange={(e) =>
                  update({
                    features: { ...answers.features, [f.key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── ステップ4 ──
function Step4({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  return (
    <>
      <h2>どのくらい似せますか？</h2>
      <div className="select-grid mt-16">
        {WIZARD_RESEMBLANCE.map((r) => (
          <button
            key={r.value}
            className={`select-card ${value === r.value ? "selected" : ""}`}
            onClick={() => onSelect(r.value)}
          >
            {r.label}
            {"recommended" in r && r.recommended && <span className="sc-badge">おすすめ</span>}
            <span className="sc-desc">{r.desc}</span>
          </button>
        ))}
      </div>
      {value === "close" && (
        <div className="note-box">
          本人感が強いスタンプは、公開時に審査・プライバシーの注意が必要です。
        </div>
      )}
    </>
  );
}

// ── ステップ5 ──
function Step5({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  return (
    <>
      <h2>スタンプの雰囲気は？</h2>
      <div className="select-grid mt-16">
        {WIZARD_MOOD.map((m) => (
          <button
            key={m.value}
            className={`select-card ${value === m.value ? "selected" : ""}`}
            onClick={() => onSelect(m.value)}
          >
            <span className="sc-emoji">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── ステップ6 ──
function Step6({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  return (
    <>
      <h2>文字の雰囲気は？</h2>
      <div className="select-grid mt-16">
        {WIZARD_TEXT_STYLE.map((t) => (
          <button
            key={t.value}
            className={`select-card ${value === t.value ? "selected" : ""}`}
            onClick={() => onSelect(t.value)}
          >
            {t.label}
            {"recommended" in t && t.recommended && <span className="sc-badge">おすすめ</span>}
            <span className="sc-desc">{t.desc}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ── ステップ7：16文言の編集 ──
function Step7({
  phrases,
  setPhrases,
}: {
  phrases: PhraseItem[];
  setPhrases: React.Dispatch<React.SetStateAction<PhraseItem[]>>;
}) {
  function updatePhrase(no: number, patch: Partial<PhraseItem>) {
    setPhrases((ps) => ps.map((p) => (p.no === no ? { ...p, ...patch } : p)));
  }
  return (
    <>
      <h2>文言の確認</h2>
      <p className="text-sub">
        16枚の文言と、文字の主要色を確認・編集できます。このままでもOKです。
      </p>
      <div className="stack mt-16">
        {phrases.map((p) => (
          <div className="tip-item" key={p.no}>
            <div className="row between" style={{ gap: 10 }}>
              <strong style={{ minWidth: 24 }}>{String(p.no).padStart(2, "0")}</strong>
              <input
                className="input"
                value={p.text}
                onChange={(e) => updatePhrase(p.no, { text: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
            <div className="color-chips mt-8">
              {COLOR_CHIPS.map((c) => (
                <button
                  key={c.value}
                  className={`color-chip ${p.color === c.value ? "selected" : ""}`}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => updatePhrase(p.no, { color: c.value })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
