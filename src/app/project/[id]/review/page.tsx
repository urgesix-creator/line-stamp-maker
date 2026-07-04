import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewClient } from "./ReviewClient";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

// S6 全16枚確認画面
export default async function ReviewPage({
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

  return <ReviewClient projectId={id} phrases={project.phrases} />;
}
