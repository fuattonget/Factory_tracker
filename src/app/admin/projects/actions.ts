"use server";

import { revalidatePath } from "next/cache";
import { upsertProjectStageConfig } from "@/lib/pipes";

export async function saveProjectStageConfig(formData: FormData) {
  const project_no = String(formData.get("project_no") ?? "").trim();
  if (!project_no) {
    throw new Error("Proje numarası boş olamaz.");
  }

  await upsertProjectStageConfig({
    project_no,
    requires_additional_part: formData.get("requires_additional_part") === "on",
    requires_coating: formData.get("requires_coating") === "on",
    notes: (formData.get("notes") as string) || null,
  });

  revalidatePath("/admin/projects");
}
