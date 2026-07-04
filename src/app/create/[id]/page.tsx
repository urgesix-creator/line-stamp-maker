import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileProjectStatus } from "@/lib/projectStatus";
import { WizardClient } from "./WizardClient";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

// S4 ウィザードのエントリ。中断復帰も担う。
export default async function CreatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!data) notFound();
  let project = data as Project;
  if (project.owner_id !== profile.id) notFound();
  if (project.status === "preview_generating" || project.status === "main_generating") {
    const reconciled = await reconcileProjectStatus(id);
    project = { ...project, status: reconciled.status };
  }

  // 生成済みステータスなら該当画面へ復帰
  if (project.status === "preview_generating" || project.status === "preview_review")
    redirect(`/project/${id}/preview`);
  if (project.status === "main_generating" || project.status === "full_review")
    redirect(`/project/${id}/review`);
  if (project.status === "completed") redirect(`/project/${id}/download`);

  // 既存のアップロード写真（署名URL付き）
  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("upload_photos")
    .select("id,storage_path")
    .eq("project_id", id);
  const initialPhotos = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data: signed } = await admin.storage
        .from("uploads")
        .createSignedUrl(p.storage_path, 60 * 30);
      return { id: p.id, url: signed?.signedUrl ?? "" };
    }),
  );

  return (
    <WizardClient
      projectId={id}
      initialAnswers={project.answers}
      initialPhrases={project.phrases}
      initialPhotos={initialPhotos}
    />
  );
}
