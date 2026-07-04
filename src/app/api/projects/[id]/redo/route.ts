import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";

const REDO_RESET_SLOTS = ["base", "01", "02", "03", "04"];

// S5「雰囲気を変えてやり直す」→S4ステップ4へ戻す。
// 1セット1回まで無料、2回目以降は上限（再生成枠）を消費する。
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("owner_id,redo_used,regen_remaining,answers")
    .eq("id", id)
    .single();
  if (!project || project.owner_id !== profile.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const patch: Record<string, unknown> = {
    status: "draft",
    answers: { ...(project.answers ?? {}), step: 4 },
  };

  if (!project.redo_used) {
    patch.redo_used = true; // 初回は無料
  } else {
    if (project.regen_remaining <= 0) {
      return NextResponse.json(
        { error: "limit_reached", message: "やり直しの回数上限に達しました" },
        { status: 403 },
      );
    }
    patch.regen_remaining = project.regen_remaining - 1; // 2回目以降は消費
  }

  const { data: images } = await admin
    .from("stamp_images")
    .select("id,storage_path,prev_storage_path")
    .eq("project_id", id)
    .in("slot", REDO_RESET_SLOTS);
  const paths = (images ?? [])
    .flatMap((img) => [img.storage_path, img.prev_storage_path])
    .filter((path): path is string => !!path);
  if (paths.length) {
    await admin.storage.from(BUCKETS.stamps).remove(paths);
  }
  if (images?.length) {
    await admin
      .from("stamp_images")
      .delete()
      .in(
        "id",
        images.map((img) => img.id),
      );
  }

  await admin.from("projects").update(patch).eq("id", id);
  return NextResponse.json({ ok: true });
}
