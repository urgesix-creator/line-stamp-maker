import { createAdminClient, BUCKETS } from "./supabase/admin";

// ─────────────────────────────────────────────────────────────
// Storageヘルパー（署名付き期限付きURLでのみ配信・7章セキュリティ）
// パス規約: {user_id}/{project_id}/{file}
// ─────────────────────────────────────────────────────────────

const SIGNED_URL_TTL = 60 * 30; // 30分

export function stampPath(userId: string, projectId: string, slot: string) {
  return `${userId}/${projectId}/${slot}.png`;
}
export function photoPath(userId: string, projectId: string, name: string) {
  return `${userId}/${projectId}/${name}`;
}

export async function uploadStamp(path: string, buf: Buffer): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKETS.stamps)
    .upload(path, buf, { contentType: "image/png", upsert: true });
  if (error) throw error;
}

export async function uploadPhoto(
  path: string,
  buf: Buffer,
  contentType: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKETS.photos)
    .upload(path, buf, { contentType, upsert: true });
  if (error) throw error;
}

export async function downloadStamp(path: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKETS.stamps).download(path);
  if (error || !data) throw error ?? new Error("ダウンロード失敗");
  return Buffer.from(await data.arrayBuffer());
}

export async function downloadPhoto(path: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKETS.photos).download(path);
  if (error || !data) throw error ?? new Error("ダウンロード失敗");
  return Buffer.from(await data.arrayBuffer());
}

/** 署名付きURL（本人・管理者のみアクセス可能な期限付きURL） */
export async function signedStampUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(BUCKETS.stamps)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}
