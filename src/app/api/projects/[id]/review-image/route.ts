import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// 1枚のOK確認（S6「✓ OK」）。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { no, ok } = (await req.json()) as { no: number; ok: boolean };
  const slot = String(no).padStart(2, "0");

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await admin
    .from("stamp_images")
    .update({ review_state: ok ? "ok" : "unconfirmed" })
    .eq("project_id", id)
    .eq("slot", slot);

  return NextResponse.json({ ok: true });
}
