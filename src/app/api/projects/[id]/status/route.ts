import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileProjectStatus } from "@/lib/projectStatus";
import { signedStampUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// プロジェクトの生成状況＋画像の署名URLを返す（S5/S6のポーリング用）。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (project.owner_id !== profile.id && profile.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const reconciled = await reconcileProjectStatus(id);

  const { data: images } = await admin
    .from("stamp_images")
    .select("slot,storage_path,review_state,prev_storage_path,clothing_history")
    .eq("project_id", id);

  const withUrls = await Promise.all(
    (images ?? []).map(async (img) => ({
      slot: img.slot,
      review_state: img.review_state,
      hasPrev: !!img.prev_storage_path,
      url: img.storage_path ? await signedStampUrl(img.storage_path) : null,
    })),
  );

  // 残申請中の枠（重複ブロック・UI表示用）
  const { data: pending } = await admin
    .from("quota_requests")
    .select("kind")
    .eq("project_id", id)
    .eq("state", "pending");

  return NextResponse.json({
    status: reconciled.status,
    regen_remaining: project.regen_remaining,
    clothing_remaining: project.clothing_remaining,
    redo_used: project.redo_used,
    cost_notice_shown: project.cost_notice_shown,
    pendingKinds: (pending ?? []).map((p) => p.kind),
    images: withUrls,
  });
}
