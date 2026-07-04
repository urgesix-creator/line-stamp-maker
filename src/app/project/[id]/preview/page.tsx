import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PreviewClient } from "./PreviewClient";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

// S5 プレビュー確認画面（先行4枚）
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!data) notFound();
  const project = data as Project;
  if (project.owner_id !== profile.id && profile.role !== "admin") notFound();

  return <PreviewClient projectId={id} />;
}
