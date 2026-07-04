import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

// 日次自動削除（8章 / F6 / 7章プライバシー）
// ・アップロード写真：生成完了+7日で物理削除
// ・完成PNG：完成から90日で物理削除
// Vercel Cron から呼ばれる（vercel.json: 0 3 * * *）。CRON_SECRET で認証。
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const nowIso = new Date().toISOString();
  let deletedPhotos = 0;
  let deletedStamps = 0;

  // ── 写真：delete_after を過ぎたもの ──
  const { data: photos } = await db
    .from("upload_photos")
    .select("id,storage_path")
    .lte("delete_after", nowIso)
    .not("delete_after", "is", null);
  if (photos?.length) {
    const paths = photos.map((p) => p.storage_path);
    await db.storage.from(BUCKETS.photos).remove(paths);
    await db
      .from("upload_photos")
      .delete()
      .in(
        "id",
        photos.map((p) => p.id),
      );
    deletedPhotos = photos.length;
  }

  // ── 完成PNG：delete_after を過ぎたもの ──
  const { data: stamps } = await db
    .from("stamp_images")
    .select("id,storage_path,prev_storage_path")
    .lte("delete_after", nowIso)
    .not("delete_after", "is", null);
  if (stamps?.length) {
    const paths: string[] = [];
    for (const s of stamps) {
      if (s.storage_path) paths.push(s.storage_path);
      if (s.prev_storage_path) paths.push(s.prev_storage_path);
    }
    if (paths.length) await db.storage.from(BUCKETS.stamps).remove(paths);
    // ストレージパスをクリア（レコードは保持し「保存期間終了」表示に使う）
    await db
      .from("stamp_images")
      .update({ storage_path: null, prev_storage_path: null })
      .in(
        "id",
        stamps.map((s) => s.id),
      );
    deletedStamps = stamps.length;
  }

  return NextResponse.json({ ok: true, deletedPhotos, deletedStamps, at: nowIso });
}
