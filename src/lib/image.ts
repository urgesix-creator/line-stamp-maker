import sharp from "sharp";

// ─────────────────────────────────────────────────────────────
// 画像加工（F3 生成後処理 / F6 規格変換）
// ・透過確認（必要時は白背景の透過化フォールバック）
// ・内容と外枠の間に約10px余白を確保して 370×320 にリサイズ
// ・PNG化・1MB以下へ圧縮
// ・main.png(240×240) / tab.png(96×74) を自動生成
// ─────────────────────────────────────────────────────────────

const STAMP_W = 370;
const STAMP_H = 320;
const MARGIN = 10; // 約10px余白
const MAX_BYTES = 1024 * 1024; // 1MB以下

/** 画像がアルファ（透過）を持つか */
async function hasAlpha(buf: Buffer): Promise<boolean> {
  const meta = await sharp(buf).metadata();
  return Boolean(meta.hasAlpha);
}

/**
 * 単色背景を透過に変換するフォールバック。
 * APIやCodex出力が透過非対応だった場合に、白背景またはシアン背景を透明化する。
 */
async function flatBackgroundToTransparent(buf: Buffer): Promise<Buffer> {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels; // 4
  const out = Buffer.from(data);

  const isWhitePixel = (r: number, g: number, b: number) =>
    r >= 245 && g >= 245 && b >= 245;
  const isCyanPixel = (r: number, g: number, b: number) =>
    r < 235 &&
    g > 130 &&
    b > 130 &&
    Math.abs(g - b) < 72 &&
    g - r > 18 &&
    b - r > 18;

  let borderCount = 0;
  let whiteBorder = 0;
  let cyanBorder = 0;
  const countBorderPixel = (x: number, y: number) => {
    const idx = (y * info.width + x) * channels;
    const alpha = out[idx + 3];
    if (alpha < 16) return;
    const r = out[idx];
    const g = out[idx + 1];
    const b = out[idx + 2];
    borderCount += 1;
    if (isWhitePixel(r, g, b)) whiteBorder += 1;
    if (isCyanPixel(r, g, b)) cyanBorder += 1;
  };
  for (let x = 0; x < info.width; x += 4) {
    countBorderPixel(x, 0);
    countBorderPixel(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y += 4) {
    countBorderPixel(0, y);
    countBorderPixel(info.width - 1, y);
  }

  const removeWhite = borderCount > 0 && whiteBorder / borderCount > 0.45;
  const removeCyan = borderCount > 0 && cyanBorder / borderCount > 0.45;

  for (let i = 0; i < out.length; i += channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if ((removeWhite && isWhitePixel(r, g, b)) || (removeCyan && isCyanPixel(r, g, b))) {
      out[i + 3] = 0; // アルファを0に
    }
  }
  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** アルファのバウンディングボックスで内容をトリムする */
async function trimToContent(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf).trim({ threshold: 1 }).png().toBuffer();
  } catch {
    return buf; // 全面不透明などでtrim失敗時はそのまま
  }
}

/** PNGを1MB以下に圧縮（段階的にcompressionLevel/量子化を強める） */
async function compressUnder1MB(buf: Buffer): Promise<Buffer> {
  let out = await sharp(buf).png({ compressionLevel: 9 }).toBuffer();
  if (out.length <= MAX_BYTES) return out;
  // パレット量子化で更に圧縮
  for (const colors of [256, 128, 64]) {
    out = await sharp(buf)
      .png({ compressionLevel: 9, palette: true, colors, effort: 10 })
      .toBuffer();
    if (out.length <= MAX_BYTES) return out;
  }
  return out; // 最善を返す
}

/**
 * 生成rawバイト列を LINE規格の 370×320 透過PNG（約10px余白・1MB以下）へ整形する。
 */
export async function processStamp(raw: Buffer): Promise<Buffer> {
  // 1) 透過確認 → 必要なら白背景を透過化
  let src = raw;
  if (!(await hasAlpha(src))) {
    src = await flatBackgroundToTransparent(src);
  } else {
    // アルファはあるが単色背景が残るケースにも対応
    src = await flatBackgroundToTransparent(src);
  }

  // 2) 内容をトリム
  const trimmed = await trimToContent(src);

  // 3) 余白を確保して 370×320 の透明キャンバスに contain 配置
  const innerW = STAMP_W - MARGIN * 2;
  const innerH = STAMP_H - MARGIN * 2;
  const resized = await sharp(trimmed)
    .resize(innerW, innerH, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const canvas = await sharp({
    create: {
      width: STAMP_W,
      height: STAMP_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();

  // 4) 1MB以下へ圧縮
  return compressUnder1MB(canvas);
}

/** 01番の370×320から main.png(240×240) を生成 */
export async function makeMain(stamp01: Buffer): Promise<Buffer> {
  const buf = await sharp(stamp01)
    .resize(240, 240, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return compressUnder1MB(buf);
}

/** 01番の顔まわり中心トリミングから tab.png(96×74) を生成 */
export async function makeTab(stamp01: Buffer): Promise<Buffer> {
  const meta = await sharp(stamp01).metadata();
  const w = meta.width ?? STAMP_W;
  const h = meta.height ?? STAMP_H;
  // 上半分（顔まわり中心）を切り出す
  const cropW = Math.round(w * 0.55);
  const cropH = Math.round(h * 0.5);
  const left = Math.round((w - cropW) / 2);
  const top = Math.round(h * 0.12);
  const buf = await sharp(stamp01)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(96, 74, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return compressUnder1MB(buf);
}

/** HEIC等を含む入力をPNGに正規化（アップロード写真の参照用） */
export async function toPng(buf: Buffer): Promise<Buffer> {
  return sharp(buf).png().toBuffer();
}
