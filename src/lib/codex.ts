import {
  DEFAULT_PHRASES,
  IMAGE_NUMBERS,
  PREVIEW_NUMBERS,
  WIZARD_MOOD,
  WIZARD_RESEMBLANCE,
  WIZARD_TARGETS,
  WIZARD_TEXT_STYLE,
} from "./constants";
import type { PhraseItem, WizardAnswers } from "./types";

export type ManualStampPhase = "preview" | "remaining" | "all";

export function manualStampSlots(phase: ManualStampPhase): number[] {
  if (phase === "preview") return PREVIEW_NUMBERS;
  if (phase === "remaining") return IMAGE_NUMBERS.filter((no) => no > 4);
  return IMAGE_NUMBERS;
}

function labelOf(list: readonly { value: string; label: string }[], value: string) {
  return list.find((item) => item.value === value)?.label ?? value;
}

function featureText(answers: WizardAnswers): string {
  if (answers.hasPhoto) {
    return "写真あり。本人または使用許可を得た人物の正面顔・表情がわかる写真を参照する。";
  }

  const features = answers.features ?? {};
  const rows = [
    ["髪型", features.hair],
    ["服装", features.clothing],
    ["雰囲気", features.atmosphere],
    ["年齢感", features.age],
    ["表情", features.expression],
  ].filter(([, value]) => value && value.trim());

  if (!rows.length) return "写真なし。人物の特徴は未入力。";
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function phraseLines(phrases: PhraseItem[], slots: number[]): string {
  return slots
    .map((no) => {
      const phrase = phrases.find((item) => item.no === no);
      const defaults = DEFAULT_PHRASES.find((item) => item.no === no);
      const slot = String(no).padStart(2, "0");
      return [
        `${slot}: 「${phrase?.text ?? defaults?.text ?? ""}」`,
        `- 文字色: ${phrase?.color ?? defaults?.color ?? ""}`,
        `- キャラ: ${defaults?.pose ?? "文言に合うポーズ"}`,
        `- 装飾: ${defaults?.decoration ?? "文言に合う小さな装飾"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildCodexPrompt(
  answers: WizardAnswers,
  phrases: PhraseItem[],
  phase: ManualStampPhase,
): string {
  const slots = manualStampSlots(phase);
  const phaseText =
    phase === "preview"
      ? "まず01〜04の4枚だけ作成する。最初から16枚すべて作らない。"
      : phase === "remaining"
        ? "01〜04の方向性に合わせて、05〜16の12枚だけ作成する。"
        : "01〜16の16枚を作成する。";

  return [
    "あなたはLINEスタンプ制作アシスタントです。",
    phaseText,
    "",
    "【人物情報】",
    `対象: ${labelOf(WIZARD_TARGETS, answers.target)}`,
    `似せ方: ${labelOf(WIZARD_RESEMBLANCE, answers.resemblance)}（おすすめは似顔絵寄せ）`,
    `スタンプの雰囲気: ${labelOf(WIZARD_MOOD, answers.mood)}`,
    `文字の雰囲気: ${labelOf(WIZARD_TEXT_STYLE, answers.textStyle)}`,
    featureText(answers),
    "",
    "【人物写真を使う場合の厳守】",
    "本人または使用許可を得た人物だけを対象にする。有名人・第三者・許諾不明の写真は使わない。",
    "",
    "【画像生成の厳守】",
    "- Codexの画像生成機能で作る。",
    "- 文字入りの完成画像として生成する。",
    "- 日本語文字も画像の一部として、画像生成の中で直接描画する。",
    "- キャラクターだけを生成して、後からPillow、Canva、画像編集ソフト、HTML、SVGなどで文字を合成しない。",
    "- 文字は後処理で載せない。",
    "- 生成後、すべての日本語文字が正確か必ず確認する。",
    "- 誤字、文字化け、省略、余計な文字がある場合は、その画像だけ再生成する。",
    "",
    "【人物キャラクター化ルール】",
    "- 実写そのままではなく、かわいい手描き風キャラクターにする。",
    "- 顔の特徴、髪型、服装、雰囲気を残す。",
    "- 誇張しすぎず、好印象で親しみやすくする。",
    "- 太めの茶色または濃い線のアウトライン。",
    "- 表情は大きく、LINEの小さい表示でも伝わるようにする。",
    "",
    "【文字ルール】",
    "- 文字は単色ベタにしない。",
    "- 単語ごと、または重要語ごとに色を変える。",
    "- 手描き風の色文字にする。",
    "- 白フチだけが目立つポップ文字ではなく、色そのものが見える文字にする。",
    "- 文字は上部に大きく配置する。",
    "- キャラは文字の下に配置する。",
    "- 文字とキャラが重ならないようにする。",
    "- LINEのトーク画面で読める大きさにする。",
    "",
    "【背景と出力】",
    "- 背景は透過PNGを優先する。",
    "- 透過が難しい場合は、背景だけを明るいシアン #00D7D7 の単色にする。白背景は禁止。",
    "- 横長のLINEスタンプ構図にする。",
    "- 各画像の外枠と内容の間に10px前後の余白を入れる。",
    "- ファイル名は 01.png のように2桁番号にする。",
    "",
    "【今回作る画像】",
    phraseLines(phrases, slots),
  ].join("\n");
}
