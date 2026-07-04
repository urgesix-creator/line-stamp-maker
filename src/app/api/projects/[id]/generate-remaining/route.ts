import { after, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRemaining } from "@/lib/generation";
import { reconcileProjectStatus } from "@/lib/projectStatus";

export const runtime = "nodejs";
export const maxDuration = 300;

// 残り12枚の生成（S5「この方向で残り12枚つくる」→S6）。
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
  if (reconciled.status !== "preview_review" && reconciled.status !== "main_generating") {
    return NextResponse.json({ ok: true, status: reconciled.status });
  }

  if (reconciled.status === "preview_review") {
    await admin.from("projects").update({ status: "main_generating" }).eq("id", id);
  }

  after(async () => {
    try {
      await generateRemaining(id);
    } catch (e) {
      console.error("[generate-remaining]", e);
      await reconcileProjectStatus(id).catch((err) =>
        console.error("[generate-remaining:reconcile]", err),
      );
    }
  });

  return NextResponse.json({ ok: true, status: "main_generating" });
}
