// Mirrors supabase/schema.sql. See PROJECT_PLAN.md section 5 for the
// lifecycle these fields encode.

export type PipeStatus = "Produced" | "Repaired";

export type ProductionType = "Coil" | "Plate";
export type ProjectStatus = "In Progress" | "Completed" | "On Hold";

export interface ProjectStageConfig {
  project_no: string;
  // Diameter ("çap") and wall thickness ("kalınlık") in inches -- a
  // project's pipes are normally all one spec, matching dash_app's own
  // Ø{diameter}"x{wall_thickness}" dimensions format. Used to auto-fill
  // new pipe rows. See formatDimensions in lib/pipes.ts.
  diameter: number | null;
  wall_thickness: number | null;
  // Raw coil/skelp strip width ("W"), inches -- see computeSpiralLengthM
  // in lib/pipes.ts. One value per project row; a project needing a
  // different band width is a separate project_stage_config row instead.
  band_width: number | null;
  production_type: ProductionType | null;
  project_status: ProjectStatus | null;
  customer_name: string | null;
  // Soft delete only -- project_no is immutable. Archived projects are
  // hidden from the daily-entry project picker by default. See
  // listProjectStageConfigs / setProjectStageConfigArchived in lib/pipes.ts.
  archived: boolean;
  requires_additional_part: boolean;
  requires_coating: boolean;
  notes: string | null;
  updated_at: string;
}

// Planned sub-group within a project's total pipe count (e.g. "10 pipes,
// 55ft, has Clutch") -- see supabase/schema.sql's project_pipe_groups
// comment for the full reasoning. Dimension/band_width are NOT part of a
// group -- they stay fixed at the project level (ProjectStageConfig).
export interface ProjectPipeGroup {
  id: number;
  project_no: string;
  label: string | null;
  planned_qty: number;
  pipe_length_ft: number | null;
  features: string[];
  created_at: string;
  updated_at: string;
}

export type ProjectPipeGroupInput = Omit<
  ProjectPipeGroup,
  "id" | "created_at" | "updated_at"
>;

export interface Pipe {
  id: number;
  project_no: string;
  pipe_no: number;
  dimensions: string | null;
  pipe_length_ft: number | null;

  produced_date: string;

  repair_amount: number | null;
  // "Total Repair Amount incl. Skelp-end Welds (B.E.)" -- see
  // supabase/schema.sql's pipes.repair_amount_incl_skelp comment.
  repair_amount_incl_skelp: number | null;
  // Both server-computed only (computeRepairRatio in lib/pipes.ts) --
  // never accept these from the client. PipeInput omits both.
  repair_ratio: number | null;
  repair_ratio_incl_skelp: number | null;
  repair_count: number | null;
  repair_category: string | null;
  surface_state: string | null;
  repaired_date: string | null;
  status: PipeStatus;

  additional_part_name: string | null;
  additional_part_qty: number | null;
  additional_part_assembled_date: string | null;
  additional_part_welded_date: string | null;

  coating_done: boolean;
  coating_date: string | null;

  shipped_date: string | null;
  shipped_bare: boolean;

  // General-purpose tags, independent of the lifecycle-stage fields above
  // (informational only, don't drive warn-not-block logic). See
  // lib/pipeFeatures.ts for the preset list; anything else is free text.
  features: string[];

  // Set only when this row was bulk-added from a predefined
  // ProjectPipeGroup (progress tracking); null for ad-hoc rows.
  group_id: number | null;

  created_at: string;
  updated_at: string;
}

// Input shape for a create/update — everything the caller can set.
// id/created_at/updated_at/shipped_bare are server-derived, never accepted
// from the client (shipped_bare in particular is *computed*, see
// deriveShippedBare in pipes.ts — it is never a field someone fills in).
// repair_ratio/repair_ratio_incl_skelp are likewise server-derived (see
// computeRepairRatio in pipes.ts) -- the client only ever sends the raw
// repair amount(s), never a ratio.
export type PipeInput = Omit<
  Pipe,
  | "id"
  | "created_at"
  | "updated_at"
  | "shipped_bare"
  | "repair_ratio"
  | "repair_ratio_incl_skelp"
>;
