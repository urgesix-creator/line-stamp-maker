import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// 費用お知らせモーダルを表示済みにする（F11・初回のみ表示）。
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
    .select("owner_id")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await admin.from("projects").update({ cost_notice_shown: true }).eq("id", id);
  return NextResponse.json({ ok: true });
}
