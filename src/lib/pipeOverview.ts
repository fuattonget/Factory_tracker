import { createServiceRoleClient } from "@/lib/supabase/server";

// Ports pages/home.py:_render_pipe_overview_inner's "Newest Produced /
// Newest Repaired Pipes" tables. Reads dash_app's own pipe_repair_details
// table directly (real, populated data) -- same "dash_app tables stay the
// real source for viewing" model as src/lib/dashboard.ts.

export interface PipeRepairDetailRow {
  project_sheet: string;
  block_cell: string;
  first_seen_date: string;
  repaired_date: string | null;
  pipe_no: number;
  repair_amount: number | null;
  repair_ratio: number | null;
  status: string;
}

export interface ProjectSheetLink {
  project_sheet: string;
  project_no: string | null;
  dimensions: string | null;
  status: string;
  dates_reliable: boolean;
}

export async function loadPipeRepairDetails(): Promise<PipeRepairDetailRow[]> {
  const supabase = createServiceRoleClient();
  const rows: PipeRepairDetailRow[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("pipe_repair_details")
      .select("project_sheet, block_cell, first_seen_date, repaired_date, pipe_no, repair_amount, repair_ratio, status")
      .order("project_sheet")
      .order("block_cell")
      .range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data as PipeRepairDetailRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function loadProjectSheetLinks(): Promise<ProjectSheetLink[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("project_sheet_links")
    .select("project_sheet, project_no, dimensions, status, dates_reliable");
  if (error) throw error;
  return data as ProjectSheetLink[];
}

// Ports pages/home.py:_pipe_sheet_label_map.
export function pipeSheetLabelMap(
  links: ProjectSheetLink[],
  trustedOnly = false
): Map<string, string> {
  const map = new Map<string, string>();
  for (const link of links) {
    if (link.status !== "confirmed") continue;
    if (trustedOnly && !link.dates_reliable) continue;
    map.set(link.project_sheet, `${link.project_no} (${link.dimensions})`);
  }
  return map;
}

// pipe_repair_details.repair_amount is stored in meters, same as
// repair_rates.total_repair_amount (see calculations.py:
// apply_meter_based_repair_ratios) -- converted to ft for display, same
// factor dash_app's amount_in_display_unit uses.
const FEET_PER_METER = 1 / 0.3048;

// Same fixed floor as dash_app's PIPE_TREND_FLOOR_DATE -- pre-floor pipes
// come from the old system, where first_seen_date is a proxy rather than a
// true date. See the Python comment this ports for the full reasoning.
const PIPE_TREND_FLOOR_DATE = "2026-08-19";

export interface NewestPipeRow {
  project_no: string;
  dimensions: string;
  pipe_no: number;
  repair_amount: number | null;
  repair_ratio: number | null;
}

export interface PipeOverview {
  newestProduced: { date: string; rows: NewestPipeRow[] } | null;
  newestRepaired: { date: string; rows: NewestPipeRow[] } | null;
}

export function buildPipeOverview(
  pipes: PipeRepairDetailRow[],
  links: ProjectSheetLink[]
): PipeOverview {
  const labelMap = pipeSheetLabelMap(links, true);
  const mapped = pipes.filter((p) => labelMap.has(p.project_sheet));
  const confirmedByProjectSheet = new Map(
    links.filter((l) => l.status === "confirmed").map((l) => [l.project_sheet, l])
  );

  function toRows(source: PipeRepairDetailRow[]): NewestPipeRow[] {
    return source
      .map((p) => {
        const link = confirmedByProjectSheet.get(p.project_sheet);
        return {
          project_no: link?.project_no ?? "",
          dimensions: link?.dimensions ?? "",
          pipe_no: p.pipe_no,
          repair_amount: p.repair_amount != null ? p.repair_amount * FEET_PER_METER : null,
          repair_ratio: p.repair_ratio,
        };
      })
      .sort((a, b) => a.project_no.localeCompare(b.project_no) || a.pipe_no - b.pipe_no);
  }

  const producedOnly = mapped.filter((p) => p.first_seen_date >= PIPE_TREND_FLOOR_DATE);
  let newestProduced: PipeOverview["newestProduced"] = null;
  if (producedOnly.length > 0) {
    const latest = producedOnly.reduce((max, p) => (p.first_seen_date > max ? p.first_seen_date : max), producedOnly[0].first_seen_date);
    newestProduced = { date: latest, rows: toRows(producedOnly.filter((p) => p.first_seen_date === latest)) };
  }

  const repairedOnly = mapped.filter(
    (p) => p.repaired_date != null && p.repaired_date >= PIPE_TREND_FLOOR_DATE
  );
  let newestRepaired: PipeOverview["newestRepaired"] = null;
  if (repairedOnly.length > 0) {
    const latest = repairedOnly.reduce(
      (max, p) => (p.repaired_date! > max ? p.repaired_date! : max),
      repairedOnly[0].repaired_date!
    );
    newestRepaired = {
      date: latest,
      rows: toRows(repairedOnly.filter((p) => p.repaired_date === latest)),
    };
  }

  return { newestProduced, newestRepaired };
}
