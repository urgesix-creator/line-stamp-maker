// ─────────────────────────────────────────────────────────────
// アプリ全体で使う定数（仕様書 F4 / F8 / S4 準拠）
// ─────────────────────────────────────────────────────────────

/** 上限の既定値（F8 確定値） */
export const DEFAULT_LIMITS = {
  /** 月間セット上限：2セット/人 */
  monthlySetLimit: 2,
  /** セット内再生成上限：5回 */
  regenLimit: 5,
  /** セット内服装変更上限：3回 */
  clothingLimit: 3,
  /** 追加枠承認1回あたりの既定付与回数 */
  approvalGrant: 3,
} as const;

/** 費用単価の既定値（S8 / F11） */
export const DEFAULT_PRICING = {
  /** 通常生成 円/枚（gpt-image-2 high前提の概算） */
  perImageYen: 40,
  /** 服装変更 円/回 */
  perClothingYen: 20,
} as const;

/** 招待リンクの有効日数 */
export const INVITE_VALID_DAYS = 7;
/** 顔写真の保持日数（生成完了後に自動削除） */
export const PHOTO_RETENTION_DAYS = 7;
/** 完成PNGの保持日数（自動削除） */
export const STAMP_RETENTION_DAYS = 90;

/** 費用お知らせ文言の初期値（S7 / F11） */
export const DEFAULT_COST_MESSAGE =
  "おつかれさまでした！🎉 このアプリはAI画像生成ツール（GPT Image）を使ってスタンプを作っています。今回のスタンプ作成には {amount} の費用がかかりました（管理者が負担しています）。";

/** 案内テンプレ文の初期値（S8 セクション2） */
export const DEFAULT_INVITE_TEMPLATE =
  "スタンプを自分で作れるアプリを作りました🎨 しゃしんと5つの質問に答えるだけで、自分のLINEスタンプが作れます。使ってみたい人は返信してください！";

/** 招待メッセージの初期値（S8 セクション2）。{link} が招待リンクに置換される */
export const DEFAULT_INVITE_MESSAGE =
  "お待たせしました！こちらから登録してください（7日間有効です）→ {link}";

/** 16枚のデフォルト文言セット（F4） */
export interface DefaultPhrase {
  no: number; // 1..16
  text: string; // 文言
  color: string; // 主要色（表示用ラベル）
  pose: string; // ポーズ（サーバー側プロンプトが参照）
  decoration: string; // 装飾（サーバー側プロンプトが参照）
}

export const DEFAULT_PHRASES: DefaultPhrase[] = [
  { no: 1, text: "おはようございます", color: "赤オレンジ＋茶", pose: "笑顔で手を振る", decoration: "太陽・黄色い集中線" },
  { no: 2, text: "おつかれさまです", color: "緑＋茶", pose: "丁寧にお辞儀", decoration: "青い汗マーク・小花" },
  { no: 3, text: "ありがとうございます", color: "ピンク＋茶", pose: "ハートを持ち笑顔", decoration: "ピンクの強調線" },
  { no: 4, text: "了解です", color: "青＋茶", pose: "親指を立てる", decoration: "黄色いキラキラ" },
  { no: 5, text: "よろしくお願いします", color: "オレンジ＋茶", pose: "両手を前でお辞儀", decoration: "小さな星" },
  { no: 6, text: "承知しました", color: "青緑＋茶", pose: "敬礼ポーズ", decoration: "白い光の線" },
  { no: 7, text: "すみません…", color: "紫＋茶", pose: "眉を下げて手を合わせる", decoration: "青い縦線" },
  { no: 8, text: "お先に失礼します", color: "水色＋茶", pose: "荷物を持ち小走り", decoration: "風の線" },
  { no: 9, text: "確認します", color: "青＋茶", pose: "虫めがねを持つ", decoration: "はてなマーク" },
  { no: 10, text: "少々お待ちください", color: "黄土＋茶", pose: "両手を前に出す", decoration: "時計マーク" },
  { no: 11, text: "OKです！", color: "緑＋茶", pose: "両腕で大きな丸", decoration: "緑のキラキラ" },
  { no: 12, text: "助かります", color: "ピンク＋茶", pose: "両手を胸の前で組む", decoration: "小さなハート" },
  { no: 13, text: "がんばります", color: "赤＋茶", pose: "両こぶしを上げる", decoration: "炎マーク" },
  { no: 14, text: "おやすみなさい", color: "紺＋茶", pose: "目を閉じて枕", decoration: "月と星" },
  { no: 15, text: "また明日", color: "オレンジ＋茶", pose: "大きく手を振る", decoration: "夕日" },
  { no: 16, text: "おめでとうございます", color: "赤＋金＋茶", pose: "クラッカーを鳴らす", decoration: "紙吹雪" },
];

/** S4ステップ7の色チップ（8色） */
export const COLOR_CHIPS: { label: string; value: string }[] = [
  { label: "赤オレンジ", value: "#E8552A" },
  { label: "茶色", value: "#7A4B2B" },
  { label: "緑", value: "#2E8B57" },
  { label: "青", value: "#2A6FE8" },
  { label: "ピンク", value: "#E8579E" },
  { label: "紫", value: "#8B5CF6" },
  { label: "金", value: "#D4A017" },
  { label: "紺", value: "#2C3E70" },
];

// ── ウィザードの選択肢（S4）。データ上拡張可能な構造 ──
export const WIZARD_TARGETS = [
  { value: "self", label: "自分", emoji: "🙂" },
  { value: "family", label: "家族", emoji: "👨‍👩‍👧" },
  { value: "friend", label: "友人", emoji: "🧑‍🤝‍🧑" },
  { value: "colleague", label: "仕事仲間", emoji: "💼" },
  { value: "original", label: "オリジナルキャラ", emoji: "✨" },
  // 将来のペット対応余地（スコープ外・構造のみ確保）
] as const;

export const WIZARD_RESEMBLANCE = [
  { value: "close", label: "そっくり寄せ", desc: "本人にできるだけ近づけます", warn: true },
  { value: "caricature", label: "似顔絵寄せ", desc: "特徴をいかした似顔絵に", recommended: true },
  { value: "atmosphere", label: "雰囲気だけ", desc: "ふんわり雰囲気を寄せます" },
] as const;

export const WIZARD_MOOD = [
  { value: "work", label: "仕事・日常用", emoji: "💼" },
  { value: "casual", label: "カジュアル", emoji: "😄" },
  { value: "healing", label: "癒し系", emoji: "🌸" },
  { value: "funny", label: "おもしろ系", emoji: "🤣" },
  { value: "family", label: "家族・パートナー向け", emoji: "💕" },
] as const;

export const WIZARD_TEXT_STYLE = [
  { value: "handwritten", label: "手描き色文字", desc: "単語ごとに色分けした手描き風", recommended: true },
  { value: "pop", label: "ポップ文字", desc: "元気なポップ体" },
  { value: "round", label: "丸文字", desc: "やわらかい丸文字" },
] as const;

export const WIZARD_PHOTO_FEATURE_FIELDS = [
  { key: "hair", label: "髪型", placeholder: "例：黒髪のショート" },
  { key: "clothing", label: "服装", placeholder: "例：白いシャツ" },
  { key: "atmosphere", label: "雰囲気", placeholder: "例：やさしい感じ" },
  { key: "age", label: "年齢感", placeholder: "例：30代くらい" },
  { key: "expression", label: "表情", placeholder: "例：いつも笑顔" },
] as const;

/** 服装変更の候補チップ（F9） */
export const CLOTHING_CHIPS = [
  "スーツ",
  "白シャツ",
  "パーカー",
  "和服",
  "エプロン",
  "サンタ衣装",
  "浴衣",
] as const;

/** 服装変更の禁止ワード（F9・サーバー側判定） */
export const CLOTHING_BANNED_WORDS = [
  "裸", "全裸", "ヌード", "下着", "水着", "露出", "セクシー", "エロ", "性的",
  "暴力", "血", "武器", "銃", "ナイフ", "殺", "グロ",
  "nude", "naked", "sexy", "underwear", "bikini", "violence", "weapon", "gun", "knife", "blood",
];

/** 生成種別 */
export type GenKind = "preview" | "main" | "regen" | "clothing";
/** 追加枠の種類 */
export type RequestKind = "clothing" | "regen" | "monthly";
/** プロジェクトの状態 */
export type ProjectStatus =
  | "draft" // 下書き
  | "preview_generating" // プレビュー生成中
  | "preview_review" // プレビュー確認中
  | "main_generating" // 本生成中
  | "full_review" // 全枚確認中
  | "completed"; // 完成

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "下書き",
  preview_generating: "プレビュー生成中",
  preview_review: "プレビュー確認中",
  main_generating: "本生成中",
  full_review: "全枚確認中",
  completed: "完成",
};

/** 生成する画像番号（本体16枚） */
export const IMAGE_NUMBERS = Array.from({ length: 16 }, (_, i) => i + 1);
/** 先行プレビューの番号（1〜4） */
export const PREVIEW_NUMBERS = [1, 2, 3, 4];
