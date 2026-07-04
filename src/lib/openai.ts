import OpenAI, { toFile } from "openai";

// ─────────────────────────────────────────────────────────────
// OpenAI GPT Image ラッパー（サーバー専用・F3）
// APIキーは環境変数のみ。ブラウザに渡さない。
// アプリ内生成は GPT Image 2 の高品質設定を標準にする。
//
// 透過背景（F3）：gpt-image-2 は transparent background 非対応のため、
// 生成時はシアン背景を指示し、後段の image.ts で透過化する。
// ─────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 4, // 一時的なネットワーク断（ECONNRESET等）に自動リトライ
      timeout: 180_000, // 生成は時間がかかるため長めに
    });
  }
  return _client;
}

const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "high") as
  | "low"
  | "medium"
  | "high"
  | "auto";

// 高品質な線と文字を得るため大きめに生成し、
// 後段のsharpで約10px余白付き370×320へ整形する（F3 生成後処理）。
const GEN_SIZE = process.env.OPENAI_IMAGE_SIZE || "2048x2048";

// gpt-image-2 は透過背景非対応。旧モデルに切り替えた場合のみ透過を試す。
let transparentSupported: boolean | null = null;

function isTransparentUnsupportedError(e: unknown): boolean {
  const err = e as { param?: string; code?: string; message?: string };
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.param === "background" ||
    err?.code === "invalid_value" ||
    msg.includes("transparent background is not supported")
  );
}

export interface GenResult {
  /** PNGのraw bytes */
  buffer: Buffer;
}

type GenParams = {
  model: string;
  prompt: string;
  size: string;
  quality: typeof QUALITY;
  n: 1;
  background?: "transparent" | "opaque" | "auto";
  output_format?: "png";
  image?: Awaited<ReturnType<typeof toFile>>;
};

// 透過を優先しつつ、非対応モデルでは自動で白背景生成に切替える共通実行部。
async function runImage(
  kind: "generate" | "edit",
  base: Omit<GenParams, "background">,
): Promise<GenResult> {
  const isGptImage2 = MODEL === "gpt-image-2";
  const tryTransparent = !isGptImage2 && transparentSupported !== false;
  const attempt = async (withTransparent: boolean) => {
    const params: GenParams = { ...base, output_format: "png" };
    if (withTransparent) params.background = "transparent";
    if (!withTransparent && isGptImage2) params.background = "opaque";
    const res =
      kind === "generate"
        ? await client().images.generate(params as never)
        : await client().images.edit(params as never);
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("画像生成に失敗しました（レスポンスが空）");
    return { buffer: Buffer.from(b64, "base64") };
  };

  if (!tryTransparent) return attempt(false);
  try {
    const r = await attempt(true);
    transparentSupported = true;
    return r;
  } catch (e) {
    if (isTransparentUnsupportedError(e)) {
      // このモデルは透過非対応 → 以後は白背景生成＋後処理で透過化
      transparentSupported = false;
      return attempt(false);
    }
    throw e;
  }
}

/** 新規生成（透過背景オプションを優先） */
export async function generateImage(prompt: string): Promise<GenResult> {
  return runImage("generate", {
    model: MODEL,
    prompt,
    size: GEN_SIZE,
    quality: QUALITY,
    n: 1,
  });
}

/**
 * 参照画像つき生成（キャラクター一貫性・F3）。
 * 2枚目以降は1枚目の生成画像を参照として渡し同一キャラを維持する。
 */
export async function generateWithReference(
  prompt: string,
  reference: Buffer,
): Promise<GenResult> {
  const file = await toFile(reference, "reference.png", { type: "image/png" });
  return runImage("edit", {
    model: MODEL,
    prompt,
    size: GEN_SIZE,
    quality: QUALITY,
    n: 1,
    image: file,
  });
}

/**
 * 画像編集（服装変更・F9）。元画像＋変更指示を送り、指定部分だけ描き変える。
 */
export async function editImage(
  prompt: string,
  source: Buffer,
): Promise<GenResult> {
  const file = await toFile(source, "source.png", { type: "image/png" });
  return runImage("edit", {
    model: MODEL,
    prompt,
    size: GEN_SIZE,
    quality: QUALITY,
    n: 1,
    image: file,
  });
}
