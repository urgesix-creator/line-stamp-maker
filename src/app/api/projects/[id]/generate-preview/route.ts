import { after, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePreview } from "@/lib/generation";
import { reconcileProjectStatus } from "@/lib/projectStatus";

export const runtime = "nodejs";
export const maxDuration = 300;

// 先行4枚の生成を開始（S4最終確認 →S5）。
// サーバー関数として最後まで走るため、ブラウザを閉じても生成は継続する。
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id,status")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const reconciled = await reconcileProjectStatus(id);
  if (reconciled.status !== "draft" && reconciled.status !== "preview_generating") {
    return NextResponse.json({ ok: true, status: reconciled.status });
  }

  if (reconciled.status === "draft") {
    await admin.from("projects").update({ status: "preview_generating" }).eq("id", id);
  }

  after(async () => {
    try {
      await generatePreview(id);
    } catch (e) {
      console.error("[generate-preview]", e);
      await reconcileProjectStatus(id).catch((err) =>
        console.error("[generate-preview:reconcile]", err),
      );
    }
  });

  return NextResponse.json({ ok: true, status: "preview_generating" });
}
