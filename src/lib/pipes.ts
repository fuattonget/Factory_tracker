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

// Field-level validation -- this is the actual point of the rewrite (see
// PROJECT_PLAN.md section 1 and 6): a value that's structurally wrong (not
// a number, not a real date, a ratio outside 0-1) gets REJECTED before it
// reaches the database, the same way dash_app's validators.py should have
// caught the M35 "incl. skelp smaller than the base amount" typo at entry
// time instead of at import time. This is deliberately separate from
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
    errors.push("Pipe No pozitif bir tam sayı olmalı.");
  }
  if (!input.produced_date || !isValidDateString(input.produced_date)) {
    errors.push("Produced Date geçerli bir tarih olmalı (YYYY-MM-DD).");
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
      errors.push(`${label} geçerli bir tarih olmalı (YYYY-MM-DD).`);
    }
  }

  if (input.pipe_length_ft != null && (Number.isNaN(input.pipe_length_ft) || input.pipe_length_ft < 0)) {
    errors.push("Length (ft) negatif olamaz.");
  }
  if (input.repair_amount != null && (Number.isNaN(input.repair_amount) || input.repair_amount < 0)) {
    errors.push("Repair Amt negatif olamaz.");
  }
  if (
    input.repair_ratio != null &&
    (Number.isNaN(input.repair_ratio) || input.repair_ratio < 0 || input.repair_ratio > 1)
  ) {
    errors.push("Repair Ratio 0 ile 1 arasında olmalı (örn. %5 için 0.05).");
  }
  if (input.repair_count != null && (!Number.isInteger(input.repair_count) || input.repair_count < 0)) {
    errors.push("Repair Count negatif olmayan bir tam sayı olmalı.");
  }
  if (
    input.additional_part_qty != null &&
    (!Number.isInteger(input.additional_part_qty) || input.additional_part_qty < 0)
  ) {
    errors.push("Part Qty negatif olmayan bir tam sayı olmalı.");
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
