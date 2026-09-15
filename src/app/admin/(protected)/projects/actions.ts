"use server";

import { revalidatePath } from "next/cache";
import {
  upsertProjectStageConfig,
  getProjectStageConfig,
  setProjectStageConfigArchived,
  upsertProjectPipeGroup,
  deleteProjectPipeGroup,
} from "@/lib/pipes";
import type { ProductionType, ProjectPipeGroupInput, ProjectStatus } from "@/lib/types";

const numOrNull = (v: FormDataEntryValue | null): number | null =>
  v != null && String(v).trim() !== "" ? Number(v) : null;
const strOrNull = (v: FormDataEntryValue | null): string | null =>
  v != null && String(v).trim() !== "" ? String(v).trim() : null;

export async function saveProjectStageConfig(formData: FormData) {
  const project_no = String(formData.get("project_no") ?? "").trim();
  if (!project_no) {
    throw new Error("Project No cannot be empty.");
  }

  // archived is managed exclusively by archiveProject below -- this form
  // never touches it, so editing an already-archived project's other
  // fields can't silently un-archive it.
  const existing = await getProjectStageConfig(project_no);

  await upsertProjectStageConfig({
    project_no,
    diameter: numOrNull(formData.get("diameter")),
    wall_thickness: numOrNull(formData.get("wall_thickness")),
    band_width: numOrNull(formData.get("band_width")),
    production_type: strOrNull(formData.get("production_type")) as ProductionType | null,
    project_status: strOrNull(formData.get("project_status")) as ProjectStatus | null,
    customer_name: strOrNull(formData.get("customer_name")),
    archived: existing?.archived ?? false,
    requires_additional_part: formData.get("requires_additional_part") === "on",
    track_parts_separately: formData.get("track_parts_separately") === "on",
    requires_coating: formData.get("requires_coating") === "on",
    notes: strOrNull(formData.get("notes")),
  });

  revalidatePath("/admin/projects");
  revalidatePath("/admin/pipes");
}

export async function archiveProject(formData: FormData) {
  const project_no = String(formData.get("project_no") ?? "");
  const archived = formData.get("archived") === "true";
  await setProjectStageConfigArchived(project_no, archived);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/pipes");
}

// Groups are called directly as typed Server Actions (not <form action=...>)
// since features: string[] comes from the shared FeaturesPicker's React
// state -- awkward to round-trip through hidden form fields, and Next.js
// supports calling a "use server" function directly like this, same idiom
// already used for the /admin/api/pipes JSON payload.
export async function saveProjectPipeGroup(input: ProjectPipeGroupInput & { id?: number }) {
  if (!input.project_no.trim()) {
    throw new Error("Project No cannot be empty.");
  }
  if (!Number.isInteger(input.planned_qty) || input.planned_qty <= 0) {
    throw new Error("Planned qty must be a positive integer.");
  }
  await upsertProjectPipeGroup(input);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/pipes");
}

export async function removeProjectPipeGroup(id: number) {
  await deleteProjectPipeGroup(id);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/pipes");
}
