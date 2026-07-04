import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSettings, computeCostYen, formatYen } from "@/lib/settings";
import { DownloadClient } from "./DownloadClient";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

// S7 書き出し・ダウンロード画面（費用お知らせ含む）
export default async function DownloadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin.from("projects").select("*").eq("id", id).single();
  if (!data) notFound();
  const project = data as Project;
  if (project.owner_id !== profile.id && profile.role !== "admin") notFound();

  // 費用計算（F11）：成功生成の実績から算出
  const { data: logs } = await admin
    .from("gen_logs")
    .select("kind,success")
    .eq("project_id", id)
    .eq("success", true);
  const imageCount = (logs ?? []).filter((l) =>
    ["preview", "main", "regen"].includes(l.kind),
  ).length;
  const clothingCount = (logs ?? []).filter((l) => l.kind === "clothing").length;

  const settings = await getAppSettings();
  const cost = computeCostYen(imageCount, clothingCount, settings);
  const costText = formatYen(cost);
  const costMessage = settings.cost_message.replace("{amount}", costText);

  return (
    <DownloadClient
      projectId={id}
      costText={costText}
      costMessage={costMessage}
      showModalInitially={!project.cost_notice_shown}
    />
  );
}
