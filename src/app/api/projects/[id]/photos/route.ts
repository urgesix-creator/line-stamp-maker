import { NextResponse } from "next/server";
import heicConvert from "heic-convert";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadPhoto, photoPath } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024; // 1枚10MBまで

async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();
  return data?.owner_id === userId;
}

// 写真アップロード（S4 step3）。JPG/PNG/HEIC、1枚10MBまで。HEICはPNGへ変換。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  if (!(await ownsProject(profile.id, projectId)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "1枚10MBまでです" }, { status: 400 });

  let buf = Buffer.from(await file.arrayBuffer());
  let contentType = file.type || "image/jpeg";
  let name = file.name || "photo";

  // HEIC → PNG 変換
  const isHeic =
    /image\/heic|image\/heif/i.test(contentType) || /\.heic$|\.heif$/i.test(name);
  if (isHeic) {
    try {
      const out = await heicConvert({
        buffer: new Uint8Array(buf) as unknown as ArrayBufferLike,
        format: "PNG",
      });
      buf = Buffer.from(out);
      contentType = "image/png";
      name = name.replace(/\.(heic|heif)$/i, ".png");
    } catch (e) {
      console.error("[heic]", e);
      return NextResponse.json(
        { error: "この写真は読み込めませんでした。別の写真をお試しください" },
        { status: 400 },
      );
    }
  }

  const admin = createAdminClient();
  const filename = `photo_${Date.now()}_${Math.round(buf.length % 100000)}.${
    contentType === "image/png" ? "png" : "jpg"
  }`;
  const path = photoPath(profile.id, projectId, filename);
  try {
    await uploadPhoto(path, buf, contentType);
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }

  const { data: row } = await admin
    .from("upload_photos")
    .insert({ project_id: projectId, storage_path: path })
    .select("id")
    .single();

  // uploadsバケットの署名URL（プレビュー表示用）
  const { data: signed } = await admin.storage
    .from("uploads")
    .createSignedUrl(path, 60 * 30);

  return NextResponse.json({
    id: row?.id,
    path,
    url: signed?.signedUrl ?? null,
  });
}

// 写真削除
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  if (!(await ownsProject(profile.id, projectId)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { photoId } = await req.json();
  const admin = createAdminClient();
  const { data } = await admin
    .from("upload_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();
  if (data?.storage_path) {
    await admin.storage.from("uploads").remove([data.storage_path]);
  }
  await admin.from("upload_photos").delete().eq("id", photoId);
  return NextResponse.json({ ok: true });
}
