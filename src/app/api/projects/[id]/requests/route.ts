import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyQuotaRequest } from "@/lib/email";
import type { RequestKind } from "@/lib/constants";

const KIND_LABEL: Record<RequestKind, string> = {
  clothing: "服装変更",
  regen: "再生成（作り直し）",
  monthly: "月間セット",
};

// 追加枠の申請（F10）。同一セット・同一枠の申請中は重複不可（DBのunique indexで担保）。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { kind, reason } = (await req.json()) as {
    kind: RequestKind;
    reason?: string;
  };

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // 重複申請ブロック（申請中の同一枠があるか）
  const { data: existing } = await admin
    .from("quota_requests")
    .select("id")
    .eq("project_id", id)
    .eq("kind", kind)
    .eq("state", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "already_pending", message: "申請中です（管理者の承認待ち）" },
      { status: 409 },
    );
  }

  const { error } = await admin.from("quota_requests").insert({
    requester_id: profile.id,
    project_id: id,
    kind,
    reason: reason?.slice(0, 200) ?? null,
    state: "pending",
  });
  if (error) {
    // unique制約違反も重複扱い
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "already_pending", message: "申請中です（管理者の承認待ち）" },
        { status: 409 },
      );
    }
    console.error("[requests.create]", error);
    return NextResponse.json({ error: "申請に失敗しました" }, { status: 500 });
  }

  // 管理者へメール通知（F10）
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_INITIAL_EMAIL || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (adminEmail) {
    await notifyQuotaRequest({
      adminEmail,
      requesterName: profile.display_name || profile.email,
      kindLabel: KIND_LABEL[kind],
      reason,
      appUrl,
    });
  }

  return NextResponse.json({ ok: true });
}
