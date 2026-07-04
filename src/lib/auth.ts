import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

// ログイン中ユーザーのプロフィールを取得。未ログイン/停止中は適切に処理する。
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

// ページ用：ログイン必須。未ログインは /login、停止中は強制ログアウト。
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // 停止中・承認待ちはアプリを使えない（ログアウトしてログインへ）
  if (profile.state === "suspended" || profile.state === "pending") {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(profile.state === "pending" ? "/login?pending=1" : "/login?suspended=1");
  }
  return profile;
}

// ページ用：管理者必須。
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/home");
  return profile;
}
