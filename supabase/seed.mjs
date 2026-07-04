// ─────────────────────────────────────────────────────────────
// 初期管理者アカウントを作成するseedスクリプト。
// 使い方: .env.local を読み込んで実行
//   node --env-file=.env.local supabase/seed.mjs
// 必要な環境変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                 ADMIN_INITIAL_EMAIL, ADMIN_INITIAL_PASSWORD, ADMIN_INITIAL_NAME
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_INITIAL_EMAIL;
const password = process.env.ADMIN_INITIAL_PASSWORD;
const name = process.env.ADMIN_INITIAL_NAME || "管理者";

if (!url || !serviceKey || !email || !password) {
  console.error(
    "環境変数が不足しています: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 既存確認
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (error) throw error;
    user = data.user;
    console.log("管理者ユーザーを作成しました:", email);
  } else {
    console.log("管理者ユーザーは既に存在します:", email);
  }

  // profiles を管理者に更新（トリガーで作成済みの行を昇格）
  const { error: upErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        display_name: name,
        role: "admin",
        state: "active",
      },
      { onConflict: "id" },
    );
  if (upErr) throw upErr;
  console.log("profiles を admin に設定しました。");
  console.log("完了。ログイン: ", email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
