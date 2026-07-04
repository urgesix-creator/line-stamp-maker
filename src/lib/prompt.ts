import { DEFAULT_PHRASES } from "./constants";
import type { PhraseItem, WizardAnswers } from "./types";

// ─────────────────────────────────────────────────────────────
// サーバー側プロンプト自動組み立て（仕様書 F3 / F4 ＋ 発注者ルール）
//
// ● 文字は画像生成の中で直接描画する（後処理で載せない）。
// ● キャラ：実写そのままにせず「かわいい手描き風キャラクター」。
//   太めの茶色〜濃色のアウトライン。顔の特徴・髪型・服装・雰囲気を残す。
//   誇張しすぎず好印象。表情は大きく、小さい表示でも伝わるように。背景はシンプル（透過前提）。
// ● 文字色：単色ベタ禁止。単語／重要語ごとに色を変える手描き風の色文字。
//   「白フチだけが目立つポップ文字」ではなく、色そのものが見える文字にする。
// ● 配置：文字は上部に大きく、キャラは下、重ならない。日本語は正確に（誤字・化け・省略・追加禁止）。
// ● GPT Image 2は透過背景を直接返せないため、背景はシアン単色で生成し、後処理で透過化する。
// ─────────────────────────────────────────────────────────────

// 全体の画風（キャラ土台・各スタンプで共通して指示する核）
const ART_STYLE =
  "実写そのままにせず、かわいい手描き風のキャラクターにする。" +
  "写真風・写実・半実写・リアルなポートレート表現は禁止。2Dの似顔絵イラストとして描く。" +
  "肌の写真質感、毛穴、リアルな陰影、実写の目鼻口をそのまま貼り付けた表現は避ける。" +
  "太めの茶色〜濃色のアウトラインで縁取り、明るくやわらかい塗り。" +
  "誇張しすぎず、好印象で親しみやすい仕上がり。清潔感のあるイラスト。";

// 似せ度（デフォルメの強さ）
const RESEMBLANCE_TEXT: Record<string, string> = {
  close:
    "本人にできるだけ寄せた似顔絵にする（ただし実写ではなく手描き風キャラクター）。デフォルメは控えめ。",
  caricature:
    "本人の特徴をいかした親しみやすい似顔絵。顔の輪郭・髪型・目元・口元の特徴は残しつつ、写真ではなく2D手描きキャラクターとして整理する。",
  atmosphere:
    "本人の雰囲気を活かした、ややデフォルメを効かせた手描き風キャラクター。",
};

const MOOD_TEXT: Record<string, string> = {
  work: "きちんと感のある、仕事や日常で使える上品で親しみやすい雰囲気",
  casual: "明るくカジュアルで元気な雰囲気",
  healing: "やわらかく癒される、やさしい雰囲気",
  funny: "コミカルでおもしろい、笑える雰囲気",
  family: "あたたかく親密な、家族やパートナー向けの雰囲気",
};

// 文字スタイル（いずれも単語ごとの手描き色文字。色そのものが見えるようにする）
const TEXT_STYLE_TEXT: Record<string, string> = {
  handwritten:
    "手描き風の色文字。単語ごと（または重要語ごと）に色を変え、色そのものがはっきり見える塗りにする。白フチだけが目立つポップ文字にはしない。",
  pop:
    "元気な太文字。ただし単語ごとに色を変え、色そのものが見えるようにする（白フチだけが目立つ表現は避ける）。",
  round:
    "やわらかい丸文字。単語ごとに色を変え、色そのものが見えるようにする。",
};

/** キャラクターの画風説明（各スタンプ生成で共通して渡す） */
export function buildCharacterBase(answers: WizardAnswers): string {
  const parts: string[] = [ART_STYLE];
  parts.push(RESEMBLANCE_TEXT[answers.resemblance] ?? RESEMBLANCE_TEXT.caricature);
  parts.push(MOOD_TEXT[answers.mood] ?? MOOD_TEXT.casual);

  if (!answers.hasPhoto && answers.features) {
    const f = answers.features;
    const feat: string[] = [];
    if (f.hair) feat.push(`髪型: ${f.hair}`);
    if (f.clothing) feat.push(`服装: ${f.clothing}`);
    if (f.atmosphere) feat.push(`雰囲気: ${f.atmosphere}`);
    if (f.age) feat.push(`年齢感: ${f.age}`);
    if (f.expression) feat.push(`表情: ${f.expression}`);
    if (feat.length) parts.push("本人の特徴: " + feat.join(" / "));
  }
  parts.push(
    "表情は大きく分かりやすく、LINEの小さい表示でも気持ちが伝わるようにする。",
  );
  return parts.join(" ");
}

/**
 * 写真から「キャラクターの土台」を作るためのプロンプト（F3）。
 * 実写をかわいい手描き風キャラに変換し、顔の特徴・髪型を残す。文字・装飾は入れない。
 */
export function buildCharacterPortraitPrompt(answers: WizardAnswers): string {
  return [
    "この写真の人物を、LINEスタンプ用の「かわいい手描き風キャラクター」に変換してください。実写そのままにはしない。",
    RESEMBLANCE_TEXT[answers.resemblance] ?? RESEMBLANCE_TEXT.caricature,
    "【厳守】本人の顔の特徴・髪型・髪色・雰囲気・年齢感を残し、ひと目で本人と分かるようにする。服装も参考にする。",
    "【禁止】写真の顔をそのまま貼り付けない。実写風、半実写、リアルなポートレート、写真の肌質感、細かすぎる陰影は禁止。必ず2Dの手描き似顔絵にする。",
    "太めの茶色〜濃色のアウトラインで縁取り、明るくやわらかい塗り。誇張しすぎず好印象で親しみやすく。表情は大きめ。",
    MOOD_TEXT[answers.mood] ?? MOOD_TEXT.casual,
    "上半身・正面。【重要】文字・ロゴ・吹き出し・装飾・小物・背景は一切入れない。キャラクターのみ。",
    "背景は単色の明るいシアン #00D7D7。背景以外にはこのシアン色を使わない。1体のキャラクターを中央に大きく配置する。",
  ].join("\n");
}

/** 1枚分の生成プロンプトを組み立てる */
export function buildStampPrompt(
  answers: WizardAnswers,
  phrase: PhraseItem,
): string {
  const def = DEFAULT_PHRASES.find((d) => d.no === phrase.no);
  const pose = def?.pose ?? "自然な立ちポーズ";
  const decoration = def?.decoration ?? "シンプルな装飾";
  const textStyle = TEXT_STYLE_TEXT[answers.textStyle] ?? TEXT_STYLE_TEXT.handwritten;

  return [
    "LINEスタンプ用の1枚の完成イラスト（文字込み）を作成する。日本語のキャラクタースタンプ。",
    "【最優先】参照画像の人物・キャラクターを維持する：顔の特徴・髪型・髪色・雰囲気・絵柄を変えず、同一人物・同一タッチにする。変えてよいのはポーズと文字だけ。参照が写実寄りでも、完成画像は必ず2D手描き似顔絵として描く。",
    `【画風】${buildCharacterBase(answers)}`,
    `【ポーズ】${pose}。手や体の動きで気持ちを表現する。上半身中心。`,
    `【装飾】${decoration}（小さめに、キャラクターや文字に重ならない位置へ）`,
    `【文字】画像の上部に大きく「${phrase.text}」と正確な日本語で描く。${textStyle} 主要色の指定: ${phrase.color}（この配色で単語ごとに色分けする）。`,
    "文字は必ず画像生成の中で直接描く（後から合成しない）。誤字・文字化け・省略・追加文字を絶対に作らない。指定の文言を一字一句そのまま描く。",
    "文字は上部、キャラクターは下に配置し、重ならない。トーク画面の小さい表示でもはっきり読める大きさにする。",
    "【背景】背景は単色の明るいシアン #00D7D7。模様・影・グラデーションを置かない。背景以外にはこのシアン色を使わない。後処理で背景を透過するため、キャラクター・文字・装飾の外周はシアン背景からはっきり分離する。キャラクターと文字の外周に約10pxの余白を確保する。",
    "全体は横長（370×320比率）を意識した構図。",
  ].join("\n");
}

/** 服装変更の編集プロンプト（F9） */
export function buildClothingEditPrompt(instruction: string): string {
  return [
    "この画像のキャラクターの服装だけを次の指示に従って描き変える:",
    instruction,
    "【厳守】顔・髪型・表情・ポーズ・文字（文言と色）・装飾・画風・全体の配色や構図は一切変更しない。服装のみを変更する。",
    "背景は単色の明るいシアン #00D7D7。背景以外にはこのシアン色を使わない。文字が崩れないよう注意する。",
  ].join("\n");
}
