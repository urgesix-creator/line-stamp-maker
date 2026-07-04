import { NextResponse } from "next/server";
import { generatePreview, generateRemaining } from "@/lib/generation";
import { reconcileProjectStatus } from "@/lib/projectStatus";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectStatus } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

type GeneratingProject = {
  id: string;
  status: ProjectStatus;
  created_at: string;
};

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// 生成中のまま残ったプロジェクトを定期的に再開する。
// 各スロットは保存済みならスキップするため、途中離脱・タイムアウト後も続きから進む。
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id,status,created_at")
    .in("status", ["preview_generating", "main_generating"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[resume-generation:list]", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const project = (data?.[0] ?? null) as GeneratingProject | null;
  if (!project) {
    return NextResponse.json({ ok: true, resumed: 0, results: [] });
  }

  const before = await reconcileProjectStatus(project.id);
  let resumed = false;
  if (before.status === "preview_generating") {
    resumed = true;
    await generatePreview(project.id);
  } else if (before.status === "main_generating") {
    resumed = true;
    await generateRemaining(project.id);
  }
  const after = await reconcileProjectStatus(project.id);

  return NextResponse.json({
    ok: true,
    resumed: resumed ? 1 : 0,
    results: [
      {
        id: project.id,
        before: project.status,
        after: after.status,
        generatedSlots: after.generatedSlots.length,
        missingPreviewSlots: after.missingPreviewSlots,
        missingAllSlots: after.missingAllSlots,
      },
    ],
  });
}
