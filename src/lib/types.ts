// Mirrors supabase/schema.sql. See PROJECT_PLAN.md section 5 for the
// lifecycle these fields encode.

export type PipeStatus = "Produced" | "Repaired";

export interface ProjectStageConfig {
  project_no: string;
  requires_additional_part: boolean;
  requires_coating: boolean;
  notes: string | null;
  updated_at: string;
}

export interface Pipe {
  id: number;
  project_no: string;
  pipe_no: number;
  dimensions: string | null;
  pipe_length_ft: number | null;

  produced_date: string;

  repair_amount: number | null;
  repair_ratio: number | null;
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

  created_at: string;
  updated_at: string;
}

// Input shape for a create/update — everything the caller can set.
// id/created_at/updated_at/shipped_bare are server-derived, never accepted
// from the client (shipped_bare in particular is *computed*, see
// deriveShippedBare in pipes.ts — it is never a field someone fills in).
export type PipeInput = Omit<
  Pipe,
  "id" | "created_at" | "updated_at" | "shipped_bare"
>;
