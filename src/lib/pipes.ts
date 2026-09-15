import { createServiceRoleClient } from "@/lib/supabase/server";
import { METERS_PER_FOOT } from "@/lib/units";
import type {
  Pipe,
  PipeInput,
  PipePartProgress,
  ProjectPipeGroup,
  ProjectPipeGroupInput,
  ProjectStageConfig,
} from "@/lib/types";

// --- project_stage_config -------------------------------------------------

// Excludes archived projects by default -- soft-deleting a project (see
// setProjectStageConfigArchived) is meant to actually hide it from the
// daily-entry project picker, not just flag it. Pass includeArchived when
// managing projects themselves (the /admin/projects page needs to see and
// un-archive them).
export async function listProjectStageConfigs(opts?: {
  includeArchived?: boolean;
}): Promise<ProjectStageConfig[]> {
  const supabase = createServiceRoleClient();
  let query = supabase.from("project_stage_config").select("*").order("project_no");
  if (!opts?.includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
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

// Soft delete only -- project_no is immutable, there is no rename/hard-
// delete path. Archiving just hides a project from the daily-entry picker
// (see listProjectStageConfigs); the project row and every pipe under it
// are untouched.
export async function setProjectStageConfigArchived(
  project_no: string,
  archived: boolean
): Promise<ProjectStageConfig> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_stage_config")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("project_no", project_no)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Matches dash_app's own Ø{diameter}"x{wall_thickness}" dimensions format
// (e.g. Ø90"x0.75").
export function formatDimensions(
  diameter: number | null,
  wallThickness: number | null
): string | null {
  if (diameter == null || wallThickness == null) return null;
  return `Ø${diameter}"x${wallThickness}"`;
}

// --- project_pipe_groups ----------------------------------------------------
// Planned sub-groups within a project's total pipe count -- see
// supabase/schema.sql's project_pipe_groups comment and the ProjectPipeGroup
// type doc for the full reasoning. Purely planning/target data; producing
// the actual pipes rows is unaffected if a group is never referenced.

export async function listProjectPipeGroups(
  project_no: string
): Promise<ProjectPipeGroup[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_pipe_groups")
    .select("*")
    .eq("project_no", project_no)
    .order("id");
  if (error) throw error;
  return data;
}

export async function upsertProjectPipeGroup(
  input: ProjectPipeGroupInput & { id?: number }
): Promise<ProjectPipeGroup> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_pipe_groups")
    .upsert({ ...input, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProjectPipeGroup(id: number): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("project_pipe_groups").delete().eq("id", id);
  if (error) throw error;
}

export interface ProjectPipeGroupProgress extends ProjectPipeGroup {
  /** How many real pipes rows are tagged with this group's id so far. */
  produced_qty: number;
}

// "8 of 10 from Group 1 produced so far" -- counts real pipes rows tagged
// with this group's id, so it can never drift out of sync with a manually
// maintained counter. Used by the Pipes grid's Group picker to prefill the
// remaining (not total planned) quantity.
export async function listProjectPipeGroupsWithProgress(
  project_no: string
): Promise<ProjectPipeGroupProgress[]> {
  const [groups, pipes] = await Promise.all([
    listProjectPipeGroups(project_no),
    listPipes(project_no),
  ]);
  const countByGroup = new Map<number, number>();
  for (const p of pipes) {
    if (p.group_id != null) {
      countByGroup.set(p.group_id, (countByGroup.get(p.group_id) ?? 0) + 1);
    }
  }
  return groups.map((g) => ({ ...g, produced_qty: countByGroup.get(g.id) ?? 0 }));
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

// --- pipe_part_progress -----------------------------------------------------
// Per-(pipe, feature) assembly/weld progress -- only meaningful when the
// pipe's project has track_parts_separately = true (see the schema.sql
// comment); ignored otherwise, where the shared
// pipes.additional_part_assembled_date/welded_date pair is the source of
// truth for the whole pipe. Confirmed directly by the user: some projects
// need each feature (Clutch, Back-Up Ring, etc.) tracked independently
// (e.g. Clutch welded but Back-Up Ring only assembled, on the same pipe,
// at the same time) -- others don't, hence the per-project toggle.

export async function listPipePartProgressForProject(project_no: string): Promise<PipePartProgress[]> {
  const supabase = createServiceRoleClient();
  const { data: pipes, error: pipesError } = await supabase
    .from("pipes")
    .select("id")
    .eq("project_no", project_no);
  if (pipesError) throw pipesError;
  const pipeIds = (pipes ?? []).map((p) => p.id);
  if (pipeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("pipe_part_progress")
    .select("*")
    .in("pipe_id", pipeIds);
  if (error) throw error;
  return data;
}

export async function upsertPipePartProgress(
  pipe_id: number,
  feature: string,
  fields: { assembled_date: string | null; welded_date: string | null }
): Promise<PipePartProgress> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pipe_part_progress")
    .upsert(
      { pipe_id, feature, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "pipe_id,feature" }
    )
    .select()
    .single();
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

// Ports dash_app's Excel formula (K4 = (diameter*PI/band_width)*length --
// see PROJECT_PLAN.md and the project_stage_config.band_width comment in
// supabase/schema.sql) -- diameter/band_width in inches, pipe_length_ft in
// feet, result ("spiral length") in meters. Null whenever any required
// input is missing or band_width is 0 -- the caller treats null as "can't
// compute a ratio yet," never as a validation error (see
// computeStageWarnings/computeRepairRatio below).
export function computeSpiralLengthM(
  config: Pick<ProjectStageConfig, "diameter" | "band_width">,
  pipeLengthFt: number | null
): number | null {
  if (config.diameter == null || config.band_width == null || config.band_width === 0) {
    return null;
  }
  if (pipeLengthFt == null) return null;
  return ((config.diameter * Math.PI) / config.band_width) * (pipeLengthFt * METERS_PER_FOOT);
}

// Server-computed only -- see the PipeInput comment in lib/types.ts. The
// admin only ever types a raw repair amount (in meters); this is the one
// place that amount ever turns into a ratio.
export function computeRepairRatio(
  repairAmountM: number | null,
  spiralLengthM: number | null
): number | null {
  if (repairAmountM == null || spiralLengthM == null || spiralLengthM === 0) return null;
  return repairAmountM / spiralLengthM;
}

// Each skelp-end weld ("bant eki") adds a fixed 1.5m to the repair amount
// (confirmed directly by the user). Server-computed only -- the admin
// types repair_amount and skelp_weld_count, never a B.E. total; this is
// the one place those turn into "Total Repair Amount incl. Skelp-end
// Welds." Structurally can never come out smaller than repairAmountM
// (the original "M35 bug," PROJECT_PLAN.md section 1) since it's always
// repairAmountM plus a non-negative addition.
const SKELP_WELD_LENGTH_M = 1.5;

export function computeRepairAmountInclSkelp(
  repairAmountM: number | null,
  skelpWeldCount: number | null
): number | null {
  if (repairAmountM == null) return null;
  return repairAmountM + (skelpWeldCount ?? 0) * SKELP_WELD_LENGTH_M;
}

// "Warn, don't block" (PROJECT_PLAN.md section 5 / 6): a later stage can be
// saved before an earlier required one. This never prevents a save — the
// caller (the entry form) surfaces these as inline warnings alongside the
// saved pipe.
export function computeStageWarnings(
  pipe: PipeInput,
  config: Pick<
    ProjectStageConfig,
    "requires_additional_part" | "requires_coating" | "diameter" | "band_width"
  >
): string[] {
  const warnings: string[] = [];

  if (
    (pipe.repair_amount != null || pipe.skelp_weld_count != null) &&
    computeSpiralLengthM(config, pipe.pipe_length_ft) == null
  ) {
    warnings.push(
      "Repair Ratio could not be computed — the project is missing a diameter, band width, or pipe length."
    );
  }

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

// Field-level validation -- this is the actual point of the rewrite (see
// PROJECT_PLAN.md section 1 and 6): a value that's structurally wrong (not
// a number, not a real date, a negative count) gets REJECTED before it
// reaches the database, the same way dash_app's validators.py should have
// caught the original M35 typo at entry time instead of at import time.
// (That specific bug -- an incl.-skelp amount saved smaller than the base
// amount -- no longer needs a check here at all: repair_amount_incl_skelp
// is computed as repair_amount + skelp_weld_count * 1.5, so it can never
// come out smaller in the first place. See computeRepairAmountInclSkelp.)
// This is deliberately separate from
// computeStageWarnings above: a warning means "this is plausible but
// unusual, saved anyway"; a validation error here means "this value can't
// be true," and blocks the save entirely.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export class PipeValidationError extends Error {
  constructor(public readonly fieldErrors: string[]) {
    super(fieldErrors.join(" "));
    this.name = "PipeValidationError";
  }
}

export function validatePipeInput(input: PipeInput): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(input.pipe_no) || input.pipe_no <= 0) {
    errors.push("Pipe No must be a positive integer.");
  }
  if (!input.produced_date || !isValidDateString(input.produced_date)) {
    errors.push("Produced Date must be a valid date (YYYY-MM-DD).");
  }

  const dateFields: [string, string | null][] = [
    ["Repaired Date", input.repaired_date],
    ["Additional Part Assembled Date", input.additional_part_assembled_date],
    ["Additional Part Welded Date", input.additional_part_welded_date],
    ["Coating Date", input.coating_date],
    ["Shipped Date", input.shipped_date],
  ];
  for (const [label, value] of dateFields) {
    if (value != null && !isValidDateString(value)) {
      errors.push(`${label} must be a valid date (YYYY-MM-DD).`);
    }
  }

  if (input.pipe_length_ft != null && (Number.isNaN(input.pipe_length_ft) || input.pipe_length_ft < 0)) {
    errors.push("Length (ft) cannot be negative.");
  }
  if (input.repair_amount != null && (Number.isNaN(input.repair_amount) || input.repair_amount < 0)) {
    errors.push("Repair Amt cannot be negative.");
  }
  if (
    input.skelp_weld_count != null &&
    (!Number.isInteger(input.skelp_weld_count) || input.skelp_weld_count < 0)
  ) {
    errors.push("Skelp Weld Count must be a non-negative integer.");
  }
  if (input.repair_count != null && (!Number.isInteger(input.repair_count) || input.repair_count < 0)) {
    errors.push("Repair Count must be a non-negative integer.");
  }

  return errors;
}

export interface UpsertPipeResult {
  pipe: Pipe;
  warnings: string[];
}

export async function upsertPipe(input: PipeInput): Promise<UpsertPipeResult> {
  const fieldErrors = validatePipeInput(input);
  if (fieldErrors.length > 0) {
    throw new PipeValidationError(fieldErrors);
  }

  const config = await getProjectStageConfig(input.project_no);
  const effectiveConfig = config ?? {
    project_no: input.project_no,
    diameter: null,
    band_width: null,
    requires_additional_part: false,
    requires_coating: false,
  };

  const warnings = computeStageWarnings(input, effectiveConfig);
  const shipped_bare = deriveShippedBare(input, effectiveConfig);

  const spiralLengthM = computeSpiralLengthM(effectiveConfig, input.pipe_length_ft);
  const repair_amount_incl_skelp = computeRepairAmountInclSkelp(input.repair_amount, input.skelp_weld_count);
  const repair_ratio = computeRepairRatio(input.repair_amount, spiralLengthM);
  const repair_ratio_incl_skelp = computeRepairRatio(repair_amount_incl_skelp, spiralLengthM);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pipes")
    .upsert(
      {
        ...input,
        repair_amount_incl_skelp,
        repair_ratio,
        repair_ratio_incl_skelp,
        shipped_bare,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_no,pipe_no" }
    )
    .select()
    .single();
  if (error) throw error;

  return { pipe: data, warnings };
}
