import { createAdminClient } from "./supabase/admin";
import type { AppSettings } from "./types";

// アプリ設定の取得（単価・文言）。単一行 id=1。
export async function getAppSettings(): Promise<AppSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("*").eq("id", 1).single();
  return data as AppSettings;
}

/**
 * セットの費用を算出（F11）。
 * = 成功生成枚数（プレビュー4＋本生成12＋再生成分）× 通常単価
 *   ＋ 服装変更回数 × 編集単価
 * 端数は10円単位で切り上げ。
 */
export function computeCostYen(
  successImageCount: number,
  clothingCount: number,
  settings: Pick<AppSettings, "price_per_image" | "price_per_clothing">,
): number {
  const raw =
    successImageCount * settings.price_per_image +
    clothingCount * settings.price_per_clothing;
  return Math.ceil(raw / 10) * 10;
}

/** 「約◯◯円」表記 */
export function formatYen(amount: number): string {
  return `約${amount.toLocaleString("ja-JP")}円`;
}
