import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  buildCodexPrompt,
  manualStampSlots,
  type ManualStampPhase,
} from "@/lib/codex";
import { createAdminClient } from "@/lib/supabase/admin";
import { CodexImportClient } from "./CodexImportClient";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

function phaseForStatus(status: Project["status"]): ManualStampPhase {
  if (status === "draft" || status === "preview_generating") return "preview";
  return "remaining";
}

function phaseLabel(phase: ManualStampPhase) {
  if (phase === "preview") return "先行4枚";
  if (phase === "remaining") return "残り12枚";
  return "全16枚";
}

export default async function CodexImportPage({
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
  if (project.status === "completed") redirect(`/project/${id}/download`);

  const phase = phaseForStatus(project.status);
  const slots = manualStampSlots(phase);
  const promptText = buildCodexPrompt(project.answers, project.phrases, phase);

  const { data: images } = await admin
    .from("stamp_images")
    .select("slot")
    .eq("project_id", id);
  const existingSlots = (images ?? []).map((image) => image.slot);

  return (
    <div className="container">
      <Header
        title="Codexでスタンプを作る"
        desc={`${phaseLabel(phase)}をCodexで作成し、完成PNGをこのアプリに取り込みます`}
        badge="高品質モード"
      />

      <div className="card">
        <h2>進め方</h2>
        <div className="tip-item">
          <strong>1. 制作指示をコピー</strong>
          <p className="text-sub">この画面の指示をCodexに貼り付けて画像を作ります。</p>
        </div>
        <div className="tip-item">
          <strong>2. 文字を確認</strong>
          <p className="text-sub">誤字・文字化け・余計な文字がある画像は、Codexでその1枚だけ作り直します。</p>
        </div>
        <div className="tip-item">
          <strong>3. PNGをアップロード</strong>
          <p className="text-sub">このアプリが370x320px・透過PNG・余白つきに整えます。</p>
        </div>
      </div>

      <CodexImportClient
        projectId={id}
        phase={phase}
        slots={slots}
        promptText={promptText}
        existingSlots={existingSlots}
      />

      <p className="center mt-24">
        <Link href={`/create/${id}`}>← ウィザードにもどる</Link>
      </p>
    </div>
  );
}
