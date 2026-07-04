import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyQuotaRequest } from "@/lib/email";

// 月間セット枠の追加申請（S3 →F10）。プロジェクトに紐づかない。
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

  const db = createAdminClient();
  const { data: existing } = await db
    .from("quota_requests")
    .select("id")
    .eq("requester_id", profile.id)
    .eq("kind", "monthly")
    .eq("state", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "already_pending", message: "申請中です（管理者の承認待ち）" },
      { status: 409 },
    );
  }

  const { error } = await db.from("quota_requests").insert({
    requester_id: profile.id,
    project_id: null,
    kind: "monthly",
    reason: reason?.slice(0, 200) ?? null,
    state: "pending",
  });
  if (error) {
    if (error.code === "23505")
      return NextResponse.json(
        { error: "already_pending", message: "申請中です（管理者の承認待ち）" },
        { status: 409 },
      );
    console.error("[requests.monthly]", error);
    return NextResponse.json({ error: "申請に失敗しました" }, { status: 500 });
  }

  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_INITIAL_EMAIL || "";
  if (adminEmail) {
    await notifyQuotaRequest({
      adminEmail,
      requesterName: profile.display_name || profile.email,
      kindLabel: "月間セット",
      reason,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    });
  }

  return NextResponse.json({ ok: true });
}
