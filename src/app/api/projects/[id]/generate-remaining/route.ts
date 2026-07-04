import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRemaining } from "@/lib/generation";

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

  if (project.status !== "preview_review" && project.status !== "main_generating") {
    return NextResponse.json({ ok: true, status: project.status });
  }

  try {
    await generateRemaining(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[generate-remaining]", e);
    await admin.from("projects").update({ status: "preview_review" }).eq("id", id);
    return NextResponse.json(
      { error: "生成に失敗しました。もう一度お試しください" },
      { status: 500 },
    );
  }
}
