import { IMAGE_NUMBERS, PREVIEW_NUMBERS, type ProjectStatus } from "./constants";
import { createAdminClient } from "./supabase/admin";

type SlotRow = {
  slot: string;
  storage_path: string | null;
};

type ProjectRow = {
  id: string;
  status: ProjectStatus;
};

export type ProjectStatusReconcileResult = {
  status: ProjectStatus;
  changed: boolean;
  generatedSlots: string[];
  missingPreviewSlots: string[];
  missingAllSlots: string[];
};

function slotName(no: number) {
  return String(no).padStart(2, "0");
}

function generatedSlotSet(images: SlotRow[]) {
  return new Set(
    images
      .filter((img) => /^\d\d$/.test(img.slot) && !!img.storage_path)
      .map((img) => img.slot),
  );
}

function missingSlots(generated: Set<string>, numbers: number[]) {
  return numbers
    .map(slotName)
    .filter((slot) => !generated.has(slot));
}

export async function getGeneratedNumberSlots(
  projectId: string,
): Promise<Set<number>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stamp_images")
    .select("slot,storage_path")
    .eq("project_id", projectId);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .filter((img) => /^\d\d$/.test(img.slot) && !!img.storage_path)
      .map((img) => Number(img.slot)),
  );
}

export async function reconcileProjectStatus(
  projectId: string,
): Promise<ProjectStatusReconcileResult> {
  const admin = createAdminClient();
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,status")
    .eq("id", projectId)
    .single();
  if (projectError || !project) throw projectError ?? new Error("project not found");

  const { data: images, error: imagesError } = await admin
    .from("stamp_images")
    .select("slot,storage_path")
    .eq("project_id", projectId);
  if (imagesError) throw imagesError;

  const generated = generatedSlotSet((images ?? []) as SlotRow[]);
  const missingPreviewSlots = missingSlots(generated, PREVIEW_NUMBERS);
  const missingAllSlots = missingSlots(generated, IMAGE_NUMBERS);
  let nextStatus = (project as ProjectRow).status;

  if (project.status === "preview_generating" && missingPreviewSlots.length === 0) {
    nextStatus = "preview_review";
  }
  if (project.status === "main_generating" && missingAllSlots.length === 0) {
    nextStatus = "full_review";
  }

  const changed = nextStatus !== project.status;
  if (changed) {
    const { error } = await admin
      .from("projects")
      .update({ status: nextStatus })
      .eq("id", projectId);
    if (error) throw error;
  }

  return {
    status: nextStatus,
    changed,
    generatedSlots: [...generated].sort(),
    missingPreviewSlots,
    missingAllSlots,
  };
}
