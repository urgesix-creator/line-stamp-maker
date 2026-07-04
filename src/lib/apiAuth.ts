import { getCurrentProfile } from "./auth";
import type { Profile } from "./types";

// API route 用：管理者判定。falseの場合は呼び出し側で403を返す。
export async function getAdminOrNull(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}
