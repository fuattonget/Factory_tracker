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

// --- Backlog Trend -----------------------------------------------------
// Ports pages/home.py:render_dashboard's daily Produced/Repaired/Backlog
// chart -- the single most debugged feature this session (06-131's
// block-identity instability, the dates_reliable split, the Stock-
// undercounting and Net/Stock-inconsistency regressions it caused). See
// PROJECT_PLAN.md section 1. Ported field-for-field from the Python.

const DAILY_CHARTS_WINDOW_DAYS = 14;

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateRangeISO(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  for (let d = startISO; d <= endISO; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

function maxDate(dates: (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const d of dates) {
    if (d != null && (max === null || d > max)) max = d;
  }
  return max;
}

export interface BacklogTrendPoint {
  date: string;
  produced: number;
  repaired: number;
  /** null on padded/future days beyond the last real activity -- the
   * stock line stops there rather than drawing a fake flat continuation. */
  stock: number | null;
  /** open-minus-close for this day, from the *all-confirmed* (not just
   * trusted-dates) pipe set -- the table's "Net" column, independent of
   * the trusted-only produced/repaired bars so the two can't disagree. */
  net: number;
}

export function buildBacklogTrend(
  pipes: PipeRepairDetailRow[],
  links: ProjectSheetLink[]
): BacklogTrendPoint[] | null {
  const trustedMap = pipeSheetLabelMap(links, true);
  const allMap = pipeSheetLabelMap(links, false);
  const mapped = pipes.filter((p) => trustedMap.has(p.project_sheet));
  const mappedAll = pipes.filter((p) => allMap.has(p.project_sheet));
  if (mapped.length === 0) return null;

  const repairedMapped = mapped.filter((p) => p.status === "Repaired");
  const repairedMappedAll = mappedAll.filter((p) => p.status === "Repaired");

  const latestActivity = maxDate([
    ...mapped.map((p) => p.first_seen_date),
    ...mapped.map((p) => p.repaired_date),
  ]);
  if (latestActivity === null) return null;

  const windowStartCandidate = addDaysISO(latestActivity, -(DAILY_CHARTS_WINDOW_DAYS - 1));
  const windowStart = windowStartCandidate > PIPE_TREND_FLOOR_DATE ? windowStartCandidate : PIPE_TREND_FLOOR_DATE;
  if (windowStart > latestActivity) return null; // nothing on/after the floor yet

  const paddedEndCandidate = addDaysISO(windowStart, DAILY_CHARTS_WINDOW_DAYS - 1);
  const displayEnd = paddedEndCandidate > latestActivity ? paddedEndCandidate : latestActivity;
  const dateRange = dateRangeISO(windowStart, displayEnd);

  const producedDaily = new Map<string, number>();
  for (const p of mapped) {
    if (p.first_seen_date >= windowStart) {
      producedDaily.set(p.first_seen_date, (producedDaily.get(p.first_seen_date) ?? 0) + 1);
    }
  }
  const repairedDaily = new Map<string, number>();
  for (const p of repairedMapped) {
    if (p.repaired_date && p.repaired_date >= windowStart) {
      repairedDaily.set(p.repaired_date, (repairedDaily.get(p.repaired_date) ?? 0) + 1);
    }
  }

  // Backlog/stock: +1 the day a pipe is first seen, -1 the day it's
  // repaired, over the pipe's *entire* history (all-confirmed set, not
  // just trusted-dates), then cumulatively summed.
  const netAll = new Map<string, number>();
  for (const p of mappedAll) {
    netAll.set(p.first_seen_date, (netAll.get(p.first_seen_date) ?? 0) + 1);
  }
  for (const p of repairedMappedAll) {
    if (p.repaired_date) netAll.set(p.repaired_date, (netAll.get(p.repaired_date) ?? 0) - 1);
  }
  const netAllDates = [...netAll.keys()];
  const fullHistoryStart = netAllDates.reduce((min, d) => (d < min ? d : min), netAllDates[0] ?? windowStart);

  const backlogByDate = new Map<string, number>();
  let running = 0;
  for (const d of dateRangeISO(fullHistoryStart, latestActivity)) {
    running += netAll.get(d) ?? 0;
    backlogByDate.set(d, running);
  }

  // Forward-fill onto every real day in the window (a day with no events
  // keeps the prior day's level), then map onto the (possibly padded)
  // display range *without* ffill -- padding beyond latestActivity is a
  // blank future day, not known data.
  let lastKnown: number | null = null;
  const backlogFfilled = new Map<string, number>();
  for (const d of dateRangeISO(windowStart, latestActivity)) {
    if (backlogByDate.has(d)) lastKnown = backlogByDate.get(d)!;
    if (lastKnown !== null) backlogFfilled.set(d, lastKnown);
  }

  return dateRange.map((date) => ({
    date,
    produced: producedDaily.get(date) ?? 0,
    repaired: repairedDaily.get(date) ?? 0,
    stock: backlogFfilled.get(date) ?? null,
    net: netAll.get(date) ?? 0,
  }));
}
