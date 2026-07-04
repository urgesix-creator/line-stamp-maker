import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LIMITS } from "@/lib/constants";

// 追加枠申請の承認・却下（S8 / F10）。
// 承認：即時加算（服装/再生成＝プロジェクト残数、月間＝profilesの上限）。
export async function POST(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { requestId, action, grantCount, rejectReason } = (await req.json()) as {
    requestId: string;
    action: "approve" | "reject";
    grantCount?: number;
    rejectReason?: string;
  };

  const db = createAdminClient();
  const { data: reqRow } = await db
    .from("quota_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!reqRow) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (reqRow.state !== "pending")
    return NextResponse.json({ error: "処理済みです" }, { status: 400 });

  if (action === "reject") {
    await db
      .from("quota_requests")
      .update({
        state: "rejected",
        reject_reason: rejectReason ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    return NextResponse.json({ ok: true });
  }

  // 承認：付与
  const grant = grantCount ?? DEFAULT_LIMITS.approvalGrant;

  if (reqRow.kind === "clothing" || reqRow.kind === "regen") {
    const col = reqRow.kind === "clothing" ? "clothing_remaining" : "regen_remaining";
    const { data: project } = await db
      .from("projects")
      .select(col)
      .eq("id", reqRow.project_id)
      .single();
    const current = (project as Record<string, number>)?.[col] ?? 0;
    await db
      .from("projects")
      .update({ [col]: current + grant })
      .eq("id", reqRow.project_id);
  } else if (reqRow.kind === "monthly") {
    const { data: prof } = await db
      .from("profiles")
      .select("monthly_set_limit")
      .eq("id", reqRow.requester_id)
      .single();
    const current = prof?.monthly_set_limit ?? DEFAULT_LIMITS.monthlySetLimit;
    await db
      .from("profiles")
      .update({ monthly_set_limit: current + grant })
      .eq("id", reqRow.requester_id);
  }

  await db
    .from("quota_requests")
    .update({
      state: "approved",
      grant_count: grant,
      processed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  return NextResponse.json({ ok: true });
}
