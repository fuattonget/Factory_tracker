import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Pipe, PipeInput, ProjectStageConfig } from "@/lib/types";

// --- project_stage_config -------------------------------------------------

export async function listProjectStageConfigs(): Promise<ProjectStageConfig[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_stage_config")
    .select("*")
    .order("project_no");
  if (error) throw error;
  return data;
}

export async function getProjectStageConfig(
  project_no: string
): Promise<ProjectStageConfig | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_stage_config")
    .select("*")
    .eq("project_no", project_no)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProjectStageConfig(
  config: Omit<ProjectStageConfig, "updated_at">
): Promise<ProjectStageConfig> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_stage_config")
    .upsert({ ...config, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- pipes -----------------------------------------------------------------

export async function listPipes(project_no?: string): Promise<Pipe[]> {
  const supabase = createServiceRoleClient();
  let query = supabase.from("pipes").select("*").order("pipe_no");
  if (project_no) query = query.eq("project_no", project_no);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// SHIPPED BARE (per PROJECT_PLAN.md section 5) is not something anyone
// types in — it's a derived flag: a project that requires coating, on a
// pipe that shipped without ever getting coating_done. Recomputed on every
// save so it can never drift from the fields it depends on.
export function deriveShippedBare(
  pipe: Pick<PipeInput, "shipped_date" | "coating_done">,
  config: Pick<ProjectStageConfig, "requires_coating">
): boolean {
  return Boolean(
    pipe.shipped_date && config.requires_coating && !pipe.coating_done
  );
}

// "Warn, don't block" (PROJECT_PLAN.md section 5 / 6): a later stage can be
// saved before an earlier required one. This never prevents a save — the
// caller (the entry form) surfaces these as inline warnings alongside the
// saved pipe.
export function computeStageWarnings(
  pipe: PipeInput,
  config: Pick<
    ProjectStageConfig,
    "requires_additional_part" | "requires_coating"
  >
): string[] {
  const warnings: string[] = [];

  if (pipe.status === "Repaired" && !pipe.repaired_date) {
    warnings.push("Status is Repaired but repaired_date is missing.");
  }
  if (pipe.repaired_date && pipe.repaired_date < pipe.produced_date) {
    warnings.push("repaired_date is before produced_date.");
  }

  if (config.requires_additional_part) {
    if (pipe.additional_part_welded_date && !pipe.additional_part_assembled_date) {
      warnings.push(
        "Additional-part weld date is set but the assembly date is still missing."
      );
    }
    if (
      (pipe.additional_part_assembled_date ||
        pipe.additional_part_welded_date) &&
      pipe.status !== "Repaired"
    ) {
      warnings.push(
        "Additional-part work recorded before the pipe is marked Repaired."
      );
    }
  }

  if (config.requires_coating && pipe.shipped_date && !pipe.coating_date) {
    warnings.push(
      "Shipped before a coating date was recorded — this pipe will be flagged shipped bare."
    );
  }

  if (pipe.shipped_date && pipe.status !== "Repaired") {
    warnings.push("Shipped before the pipe is marked Repaired.");
  }

  return warnings;
}

export interface UpsertPipeResult {
  pipe: Pipe;
  warnings: string[];
}

export async function upsertPipe(input: PipeInput): Promise<UpsertPipeResult> {
  const config = await getProjectStageConfig(input.project_no);
  const effectiveConfig = config ?? {
    project_no: input.project_no,
    requires_additional_part: false,
    requires_coating: false,
  };

  const warnings = computeStageWarnings(input, effectiveConfig);
  const shipped_bare = deriveShippedBare(input, effectiveConfig);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pipes")
    .upsert(
      { ...input, shipped_bare, updated_at: new Date().toISOString() },
      { onConflict: "project_no,pipe_no" }
    )
    .select()
    .single();
  if (error) throw error;

  return { pipe: data, warnings };
}
