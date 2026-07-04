import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role キーを使うサーバー専用クライアント。RLSをバイパスする。
// - 招待トークンの検証（未ログインでも参照が必要）
// - 生成画像のStorage書き込み・署名付きURL発行
// - 日次削除、管理者集計 等
// 絶対にブラウザへ渡さないこと（このモジュールはサーバーからのみ import する）。
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

/** ストレージのバケット名 */
export const BUCKETS = {
  photos: "uploads", // アップロード写真（非公開）
  stamps: "stamps", // 生成スタンプPNG（非公開）
} as const;
