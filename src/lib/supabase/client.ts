"use client";

import { createBrowserClient } from "@supabase/ssr";

// ブラウザ側で使うSupabaseクライアント（anonキー・RLSの制約下で動作）
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
