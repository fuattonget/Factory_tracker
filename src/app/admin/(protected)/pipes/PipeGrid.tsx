"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { DataGrid, renderTextEditor, type Column, type RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { Pipe, PipeInput, PipePartProgress, ProjectStageConfig } from "@/lib/types";
import type { ProjectPipeGroupProgress } from "@/lib/pipes";
import { formatDimensions, computeSpiralLengthM, computeRepairRatio } from "@/lib/pipes";
import { FeaturesPicker } from "@/components/FeaturesPicker";
import { SummaryCard } from "@/components/SummaryCard";

// Everything in the grid is a string (text-editor cells) or boolean
// (checkbox cells) -- converted to a real PipeInput only on save. Keeps
// every cell freely editable/blank while typing, which a strict numeric
// type wouldn't allow. features stays a real string[] since it has its
// own picker editor, not a text editor. repair_ratio(_incl_skelp) and
// repair_amount_incl_skelp are display-only strings, refreshed from the
// server's response after each save -- see handleSave -- never sent back
// as input (PipeInput doesn't even have a slot for them, see lib/types.ts).
interface GridRow {
  rowId: string; // client-only key, stable across edits
  pipe_no: string;
  dimensions: string;
  pipe_length_ft: string;
  produced_date: string;
  status: "Produced" | "Repaired";
  repair_amount: string;
  skelp_weld_count: string;
  repair_amount_incl_skelp: string;
  repair_ratio: string;
  repair_ratio_incl_skelp: string;
  repair_count: string;
  repaired_date: string;
  additional_part_assembled_date: string;
  additional_part_welded_date: string;
  coating_done: boolean;
  coating_date: string;
  shipped_date: string;
  features: string[];
  // Set when this row was added from a predefined project group -- see the
  // "Group" picker below. Null for ad-hoc rows.
  group_id: number | null;
}

function pipeToRow(p: Pipe): GridRow {
  return {
    rowId: String(p.id),
    pipe_no: String(p.pipe_no),
    dimensions: p.dimensions ?? "",
    pipe_length_ft: p.pipe_length_ft?.toString() ?? "",
    produced_date: p.produced_date,
    status: p.status,
    repair_amount: p.repair_amount?.toString() ?? "",
    skelp_weld_count: p.skelp_weld_count?.toString() ?? "",
    repair_amount_incl_skelp: p.repair_amount_incl_skelp?.toString() ?? "",
    repair_ratio: p.repair_ratio?.toString() ?? "",
    repair_ratio_incl_skelp: p.repair_ratio_incl_skelp?.toString() ?? "",
    repair_count: p.repair_count?.toString() ?? "",
    repaired_date: p.repaired_date ?? "",
    additional_part_assembled_date: p.additional_part_assembled_date ?? "",
    additional_part_welded_date: p.additional_part_welded_date ?? "",
    coating_done: p.coating_done,
    coating_date: p.coating_date ?? "",
    shipped_date: p.shipped_date ?? "",
    features: p.features ?? [],
    group_id: p.group_id,
  };
}

function emptyRow(overrides: Partial<GridRow> = {}): GridRow {
  return {
    rowId: `new-${crypto.randomUUID()}`,
    pipe_no: "",
    dimensions: "",
    pipe_length_ft: "",
    produced_date: "",
    status: "Produced",
    repair_amount: "",
    skelp_weld_count: "",
    repair_amount_incl_skelp: "",
    repair_ratio: "",
    repair_ratio_incl_skelp: "",
    repair_count: "",
    repaired_date: "",
    additional_part_assembled_date: "",
    additional_part_welded_date: "",
    coating_done: false,
    coating_date: "",
    shipped_date: "",
    features: [],
    group_id: null,
    ...overrides,
  };
}

// Yesterday, local time -- the daily entry workflow is "today's report
// covers yesterday's floor activity" (confirmed directly by the user), so
// new rows default here rather than to today. Only the date portion is
// used, so the local/UTC distinction doesn't otherwise matter.
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const strOrNull = (s: string) => (s.trim() === "" ? null : s.trim());

function rowToPipeInput(row: GridRow, projectNo: string): PipeInput | null {
  if (row.pipe_no.trim() === "" || row.produced_date.trim() === "") {
    return null; // incomplete row, skip silently -- not every blank row is meant to be saved
  }
  return {
    project_no: projectNo,
    pipe_no: Number(row.pipe_no),
    dimensions: strOrNull(row.dimensions),
    pipe_length_ft: numOrNull(row.pipe_length_ft),
    produced_date: row.produced_date.trim(),
    repair_amount: numOrNull(row.repair_amount),
    skelp_weld_count: numOrNull(row.skelp_weld_count) as number | null,
    repair_count: numOrNull(row.repair_count) as number | null,
    repaired_date: strOrNull(row.repaired_date),
    status: row.status,
    additional_part_assembled_date: strOrNull(row.additional_part_assembled_date),
    additional_part_welded_date: strOrNull(row.additional_part_welded_date),
    coating_done: row.coating_done,
    coating_date: strOrNull(row.coating_date),
    shipped_date: strOrNull(row.shipped_date),
    features: row.features,
    group_id: row.group_id,
  };
}

// Which stage-queue a pipe currently belongs to -- purely a function of
// what's filled in already, so a pipe always shows in exactly one section
// (confirmed directly by the user: pipes should visibly move from queue to
// queue as work on them completes, not sit scattered across one wide
// table). "done" means everything applicable is complete -- it only shows
// up in the All Pipes table below, not in any queue.
type Stage = "repair" | "additional_part" | "coating" | "ship" | "done";

function partProgressKey(pipeId: string, feature: string): string {
  return `${pipeId}::${feature}`;
}

// A pipe's additional-part stage is done either when the one shared
// Assembled/Welded pair is set (the simple default), or -- when this
// project has track_parts_separately on, see project_stage_config in
// supabase/schema.sql -- once EVERY one of its features has its own
// welded_date recorded in pipe_part_progress. A pipe with no features
// vacuously has nothing left to track.
function stageOf(
  row: GridRow,
  config: Pick<ProjectStageConfig, "requires_additional_part" | "requires_coating" | "track_parts_separately">,
  partProgressByKey?: Map<string, PipePartProgress>
): Stage {
  if (row.repair_amount.trim() === "") return "repair";
  if (config.requires_additional_part) {
    const additionalPartDone = config.track_parts_separately
      ? row.features.every((f) => partProgressByKey?.get(partProgressKey(row.rowId, f))?.welded_date != null)
      : row.additional_part_assembled_date.trim() !== "" && row.additional_part_welded_date.trim() !== "";
    if (!additionalPartDone) return "additional_part";
  }
  if (config.requires_coating && !row.coating_done) return "coating";
  if (row.shipped_date.trim() === "") return "ship";
  return "done";
}

function StatusEditor({ row, onRowChange, onClose }: { row: GridRow; onRowChange: (r: GridRow) => void; onClose: (commit: boolean) => void }) {
  return (
    <select
      autoFocus
      value={row.status}
      onChange={(e) => {
        onRowChange({ ...row, status: e.target.value as GridRow["status"] });
      }}
      onBlur={() => onClose(true)}
      className="h-full w-full border-none bg-white px-2 text-sm outline-none"
    >
      <option value="Produced">Produced</option>
      <option value="Repaired">Repaired</option>
    </select>
  );
}

function FeaturesCell({ row }: { row: GridRow }) {
  return (
    <div className="flex h-full items-center overflow-hidden text-ellipsis whitespace-nowrap px-2 text-slate-700">
      {row.features.length > 0 ? row.features.join(", ") : <span className="text-slate-300">—</span>}
    </div>
  );
}

// Rendered as an absolutely-positioned popup since a checkbox list needs
// more room than one grid cell -- the picker itself (presets + custom-tag
// input) is shared with the project Groups form, see FeaturesPicker.
function FeaturesEditor({
  row,
  onRowChange,
  onClose,
}: {
  row: GridRow;
  onRowChange: (r: GridRow) => void;
  onClose: (commit: boolean) => void;
}) {
  return (
    <div className="absolute left-0 top-0 z-20 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <FeaturesPicker features={row.features} onChange={(features) => onRowChange({ ...row, features })} />
      <button
        type="button"
        onClick={() => onClose(true)}
        className="mt-2 w-full rounded bg-blue-600 py-1 text-sm font-medium text-white hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );
}

// repair_ratio(_incl_skelp) and repair_amount_incl_skelp are never typed
// in -- the admin only enters a repair amount (meters) and a skelp-weld
// count, everything here is computed server-side from those plus the
// project's diameter/band_width (see computeRepairRatio /
// computeRepairAmountInclSkelp in lib/pipes.ts). Read-only display cells.
function RatioCell({ value }: { value: string }) {
  const n = Number(value);
  const display = value.trim() !== "" && Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : null;
  return (
    <div className="flex h-full items-center justify-end px-2 tabular-nums text-slate-500">
      {display ?? <span className="text-slate-300">—</span>}
    </div>
  );
}

function AmountCell({ value }: { value: string }) {
  const n = Number(value);
  const display = value.trim() !== "" && Number.isFinite(n) ? n.toFixed(2) : null;
  return (
    <div className="flex h-full items-center justify-end px-2 tabular-nums text-slate-500">
      {display ?? <span className="text-slate-300">—</span>}
    </div>
  );
}

// A checkbox that stands in for a date field: checking it stamps `value`
// with the current Report Date (so the admin never has to type a date for
// a plain "is this done" fact); unchecking an already-set one asks for
// confirmation first, since that means undoing a completed step rather
// than just correcting a typo. The date itself still shows next to the
// box, in small text, once set.
function DoneDateCell({
  value,
  reportDate,
  onChange,
  confirmMessage,
}: {
  value: string;
  reportDate: string;
  onChange: (next: string) => void;
  confirmMessage: string;
}) {
  const checked = value.trim() !== "";
  function handleChange(next: boolean) {
    if (next) {
      onChange(reportDate);
    } else if (window.confirm(confirmMessage)) {
      onChange("");
    }
  }
  return (
    <div className="flex h-full items-center justify-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
      />
      {checked && <span className="text-xs text-slate-400">{value}</span>}
    </div>
  );
}

// Same idea as DoneDateCell, but coating has its own boolean column
// (coating_done) alongside the date, so both fields move together here
// instead of inferring "done" purely from date presence.
function CoatingCell({
  row,
  reportDate,
  onRowChange,
}: {
  row: GridRow;
  reportDate: string;
  onRowChange: (r: GridRow) => void;
}) {
  function handleChange(next: boolean) {
    if (next) {
      onRowChange({ ...row, coating_done: true, coating_date: reportDate });
    } else if (window.confirm("Remove the Coating Done mark? This will also clear the coating date.")) {
      onRowChange({ ...row, coating_done: false, coating_date: "" });
    }
  }
  return (
    <div className="flex h-full items-center justify-center gap-1.5">
      <input
        type="checkbox"
        checked={row.coating_done}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
      />
      {row.coating_done && row.coating_date && <span className="text-xs text-slate-400">{row.coating_date}</span>}
    </div>
  );
}

interface SaveResult {
  ok: boolean;
  pipe?: Pipe;
  warnings?: string[];
  error?: string;
}

// One stage-queue table: a narrow slice of columns, a filtered slice of
// rows, and a summary line below it -- deliberately much smaller than the
// old one-giant-table-with-every-column view, since finding a specific
// pipe in a wall of columns was the whole complaint (confirmed directly by
// the user).
function StageSection({
  title,
  summary,
  rows,
  columns,
  onRowsChange,
  onSave,
  saving,
}: {
  title: string;
  summary: string;
  rows: GridRow[];
  columns: Column<GridRow>[];
  onRowsChange: (rows: GridRow[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div
        className="rdg-light overflow-hidden rounded-xl border border-slate-200"
        style={
          {
            "--rdg-border-color": "#e2e8f0",
            "--rdg-header-background-color": "#f8fafc",
            "--rdg-row-hover-background-color": "#eff6ff",
            "--rdg-selection-color": "#2563eb",
            "--rdg-color": "#1e293b",
            "--rdg-font-size": "13px",
          } as React.CSSProperties
        }
      >
        <DataGrid
          columns={columns}
          rows={rows}
          onRowsChange={onRowsChange}
          rowKeyGetter={(row: GridRow) => row.rowId}
          style={{ blockSize: Math.min(320, 40 + rows.length * 36), border: "none" }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-slate-500">{summary}</p>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// Only rendered when config.track_parts_separately is on -- one row per
// (pipe, feature) still awaiting its own weld, instead of the shared
// Assembled/Welded columns StageSection normally shows. Each checkbox
// saves immediately (a dedicated endpoint, /admin/api/pipe-part-progress
// -- this data doesn't live on the pipes row the main Save button
// submits), so there's no separate Save button here.
function PartsChecklistSection({
  rows,
  partProgressByKey,
  reportDate,
  onToggle,
}: {
  rows: GridRow[];
  partProgressByKey: Map<string, PipePartProgress>;
  reportDate: string;
  onToggle: (rowId: string, pipeNo: string, feature: string, field: "assembled_date" | "welded_date", value: string) => void;
}) {
  const items = rows.flatMap((row) =>
    row.features
      .filter((feature) => !partProgressByKey.get(partProgressKey(row.rowId, feature))?.welded_date)
      .map((feature) => ({ row, feature }))
  );
  if (items.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Awaiting Additional Part</h3>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Pipe No</th>
              <th className="px-3 py-2 text-left">Feature</th>
              <th className="px-3 py-2 text-center">Assembled</th>
              <th className="px-3 py-2 text-center">Welded</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ row, feature }) => {
              const progress = partProgressByKey.get(partProgressKey(row.rowId, feature));
              return (
                <tr key={`${row.rowId}-${feature}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{row.pipe_no}</td>
                  <td className="px-3 py-2 text-slate-700">{feature}</td>
                  <td className="px-3 py-2">
                    <DoneDateCell
                      value={progress?.assembled_date ?? ""}
                      reportDate={reportDate}
                      onChange={(v) => onToggle(row.rowId, row.pipe_no, feature, "assembled_date", v)}
                      confirmMessage={`Remove the Assembled mark for ${feature} on pipe ${row.pipe_no}? This will also clear its date.`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <DoneDateCell
                      value={progress?.welded_date ?? ""}
                      reportDate={reportDate}
                      onChange={(v) => onToggle(row.rowId, row.pipe_no, feature, "welded_date", v)}
                      confirmMessage={`Remove the Welded mark for ${feature} on pipe ${row.pipe_no}? This will also clear its date.`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {items.length} item{items.length === 1 ? "" : "s"} awaiting per-feature assembly/weld
      </p>
    </div>
  );
}

export function PipeGrid({
  projectNo,
  config,
  initialPipes,
  initialPartProgress,
  groups,
}: {
  projectNo: string;
  config: ProjectStageConfig;
  initialPipes: Pipe[];
  initialPartProgress: PipePartProgress[];
  groups: ProjectPipeGroupProgress[];
}) {
  const [rows, setRows] = useState<GridRow[]>(() => initialPipes.map(pipeToRow));
  const [partProgress, setPartProgress] = useState<PipePartProgress[]>(initialPartProgress);
  const partProgressByKey = useMemo(() => {
    const map = new Map<string, PipePartProgress>();
    for (const p of partProgress) map.set(partProgressKey(String(p.pipe_id), p.feature), p);
    return map;
  }, [partProgress]);

  // Which stage-queue section each row renders in -- deliberately NOT
  // recomputed on every keystroke (see mergeRows below): typing a Repair
  // Amt shouldn't yank the row out of Awaiting Repair before the admin
  // also gets to fill in Skelp Welds on the same row (confirmed directly
  // by the user -- this was the exact bug). A row only moves once Save
  // confirms the new state with the server.
  const [stageAssignment, setStageAssignment] = useState<Record<string, Stage>>(() => {
    const initialMap = new Map<string, PipePartProgress>();
    for (const p of initialPartProgress) initialMap.set(partProgressKey(String(p.pipe_id), p.feature), p);
    return Object.fromEntries(
      initialPipes.map((p) => [String(p.id), stageOf(pipeToRow(p), config, initialMap)])
    );
  });
  const [saving, setSaving] = useState(false);
  const [warningsByRow, setWarningsByRow] = useState<Record<string, string[]>>({});
  const [errorsByRow, setErrorsByRow] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showAllPipes, setShowAllPipes] = useState(false);
  // Unsaved edits are easy to lose by accident (closing the tab,
  // refreshing, clicking away to another page) -- flagged as critical by
  // the user, so this is deliberately belt-and-suspenders: a native
  // browser prompt on tab close/refresh/leaving the site, AND an in-app
  // confirm before following any link away from this page while dirty.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      if (!hasUnsavedChanges) return;
      const anchor = (e.target as HTMLElement)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!window.confirm("You have unsaved changes on this page. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    // Capture phase, so this runs before Next.js's own Link click handler.
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [hasUnsavedChanges]);

  const defaultDimensions = formatDimensions(config.diameter, config.wall_thickness) ?? "";

  // The daily-entry Report Date -- stamps produced_date for every new row
  // added below, and is what DoneDateCell/CoatingCell stamp onto a
  // completion checkbox, defaulting to yesterday since a report entered
  // today covers yesterday's floor activity (confirmed directly by the
  // user). Stays editable per row afterward for correction.
  const [reportDate, setReportDate] = useState(yesterdayISO);

  // Pipe numbers arrive in physical production order, but which planned
  // group each one turns out to be isn't known ahead of time (confirmed
  // directly by the user -- e.g. pipe 1 = 50ft, pipe 2 = 50ft, pipe 3 =
  // 55ft, pipe 4 = 50ft again). So adding a pipe is: pick which group this
  // next one belongs to, then Add -- exactly two actions, one pipe per
  // click. Every pipe must come from a group (confirmed directly by the
  // user) -- there's deliberately no "manual, no group" option here.
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Merges an edited slice of rows (from any one stage section, or the
  // All Pipes table) back into the full row list by rowId -- every section
  // shares one merge path so "entering a repair amount for the first time
  // marks the pipe Repaired and stamps today's Report Date as the repaired
  // date" (so the admin never fills that bookkeeping in by hand) behaves
  // identically everywhere. Only fires on the empty -> filled transition,
  // so editing an already-repaired pipe's amount later never re-stamps it.
  function mergeRows(edited: GridRow[]) {
    setHasUnsavedChanges(true);
    setRows((prev) => {
      const editedById = new Map(edited.map((r) => [r.rowId, r]));
      return prev.map((prevRow) => {
        const next = editedById.get(prevRow.rowId);
        if (!next) return prevRow;
        if (prevRow.repair_amount.trim() === "" && next.repair_amount.trim() !== "") {
          return { ...next, status: "Repaired", repaired_date: next.repaired_date || reportDate };
        }
        return next;
      });
    });
  }

  function handleRowsChange(newRows: GridRow[], _data: RowsChangeData<GridRow>) {
    mergeRows(newRows);
  }

  function nextPipeNo(): number {
    const nums = rows.map((r) => Number(r.pipe_no)).filter((n) => Number.isFinite(n) && n > 0);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }

  // The only way pipes get entered: pick which group this next pipe
  // belongs to, then Add -- one click adds one row, auto-numbered from the
  // next free pipe number, with dimensions/length/features filled in from
  // the group and produced_date from the Report Date. No-ops if no group
  // is selected (the Add button is also disabled in that case).
  function addPipe() {
    const group = groups.find((g) => String(g.id) === selectedGroupId);
    if (!group) return;
    const row = emptyRow({
      pipe_no: String(nextPipeNo()),
      dimensions: defaultDimensions,
      pipe_length_ft: group.pipe_length_ft?.toString() ?? "",
      produced_date: reportDate,
      features: group.features,
      group_id: group.id,
    });
    setRows((r) => [...r, row]);
    setStageAssignment((prev) => ({ ...prev, [row.rowId]: "repair" }));
    setHasUnsavedChanges(true);
  }

  // Saves one (pipe, feature)'s Assembled/Welded date immediately -- a
  // dedicated endpoint since pipe_part_progress isn't part of the pipes
  // row the main Save button submits. Refreshes this pipe's stage right
  // after, since a per-feature save is already a real, confirmed write
  // (not a pending edit), same "moves only once the server confirms it"
  // rule as everywhere else on this page.
  async function handlePartProgressToggle(
    rowId: string,
    pipeNo: string,
    feature: string,
    field: "assembled_date" | "welded_date",
    value: string
  ) {
    const pipeId = Number(rowId);
    if (!Number.isFinite(pipeId)) return; // only already-saved pipes reach this section
    const existing = partProgressByKey.get(partProgressKey(rowId, feature));
    const nextFields = {
      assembled_date: field === "assembled_date" ? value || null : (existing?.assembled_date ?? null),
      welded_date: field === "welded_date" ? value || null : (existing?.welded_date ?? null),
    };

    try {
      const res = await fetch("/admin/api/pipe-part-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipe_id: pipeId, feature, ...nextFields }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const { progress }: { progress: PipePartProgress } = await res.json();

      setPartProgress((prev) => [...prev.filter((p) => !(p.pipe_id === pipeId && p.feature === feature)), progress]);

      const row = rows.find((r) => r.rowId === rowId);
      if (row) {
        const updatedMap = new Map(partProgressByKey);
        updatedMap.set(partProgressKey(rowId, feature), progress);
        setStageAssignment((prev) => ({ ...prev, [rowId]: stageOf(row, config, updatedMap) }));
      }
    } catch (err) {
      setSaveError(
        `Pipe ${pipeNo} (${feature}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const payload = rows
      .map((r) => ({ rowId: r.rowId, input: rowToPipeInput(r, projectNo) }))
      .filter((r): r is { rowId: string; input: PipeInput } => r.input !== null);

    try {
      const res = await fetch("/admin/api/pipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipes: payload.map((p) => p.input) }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const { results }: { results: SaveResult[] } = await res.json();

      const nextWarnings: Record<string, string[]> = {};
      const nextErrors: Record<string, string[]> = {};
      const nextRows = [...rows];
      const nextStages: Record<string, Stage> = {};
      results.forEach((r, i) => {
        const rowId = payload[i].rowId;
        if (r.ok && r.pipe) {
          if (r.warnings && r.warnings.length > 0) nextWarnings[rowId] = r.warnings;
          // Replace the local row with the server's version (real id,
          // computed repair_ratio(_incl_skelp)/repair_amount_incl_skelp,
          // derived shipped_bare) so the computed values show up
          // immediately, without a reload.
          const savedRow = { ...pipeToRow(r.pipe), rowId };
          const idx = nextRows.findIndex((row) => row.rowId === rowId);
          if (idx !== -1) nextRows[idx] = savedRow;
          // This is the one moment a row is allowed to move to its next
          // stage-queue section -- confirmed and saved, not mid-edit.
          nextStages[rowId] = stageOf(savedRow, config, partProgressByKey);
        } else {
          nextErrors[rowId] = [r.error ?? "Unknown error"];
        }
      });
      setRows(nextRows);
      setStageAssignment((prev) => ({ ...prev, ...nextStages }));
      setWarningsByRow(nextWarnings);
      setErrorsByRow(nextErrors);
      setSavedAt(new Date());
      // Rows that failed to save (nextErrors) are still unsaved -- only
      // clear the warning once everything went through cleanly.
      setHasUnsavedChanges(Object.keys(nextErrors).length > 0);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const allWarnings = Object.entries(warningsByRow);
  const allErrors = Object.entries(errorsByRow);

  // Filtered by the last-saved stageAssignment, not live field values --
  // see the state comment above for why (a row must not visually jump
  // sections mid-edit, before every field for its current stage is filled
  // in and saved).
  const repairRows = useMemo(
    () => rows.filter((r) => (stageAssignment[r.rowId] ?? stageOf(r, config, partProgressByKey)) === "repair"),
    [rows, stageAssignment, config, partProgressByKey]
  );
  const additionalPartRows = useMemo(
    () =>
      config.requires_additional_part
        ? rows.filter((r) => (stageAssignment[r.rowId] ?? stageOf(r, config, partProgressByKey)) === "additional_part")
        : [],
    [rows, stageAssignment, config, partProgressByKey]
  );
  const coatingRows = useMemo(
    () =>
      config.requires_coating
        ? rows.filter((r) => (stageAssignment[r.rowId] ?? stageOf(r, config, partProgressByKey)) === "coating")
        : [],
    [rows, stageAssignment, config, partProgressByKey]
  );
  const shipRows = useMemo(
    () => rows.filter((r) => (stageAssignment[r.rowId] ?? stageOf(r, config, partProgressByKey)) === "ship"),
    [rows, stageAssignment, config, partProgressByKey]
  );

  // Project-wide roll-up (Produced/Repaired/Shipped counts, an overall
  // weighted repair ratio) -- same "sum of amounts over sum of spiral
  // lengths" methodology as the public Dashboard's dailyWeightedRepairRatios
  // (src/lib/dashboard.ts), just scoped to this one project's pipes.
  const summaryStats = useMemo(() => {
    let totalRepairM = 0;
    let totalSpiralM = 0;
    let repairedCount = 0;
    for (const r of rows) {
      const amount = numOrNull(r.repair_amount);
      if (amount == null) continue;
      repairedCount += 1;
      const spiral = computeSpiralLengthM(config, numOrNull(r.pipe_length_ft));
      if (spiral != null) {
        totalRepairM += amount;
        totalSpiralM += spiral;
      }
    }
    const shippedCount = rows.filter((r) => r.shipped_date.trim() !== "").length;
    return {
      producedCount: rows.length,
      repairedCount,
      shippedCount,
      overallRatio: computeRepairRatio(totalRepairM || null, totalSpiralM || null),
    };
  }, [rows, config]);

  const repairColumns = useMemo<Column<GridRow>[]>(
    () => [
      { key: "pipe_no", name: "Pipe No", renderEditCell: renderTextEditor, width: 80 },
      { key: "dimensions", name: "Dimensions", renderEditCell: renderTextEditor, width: 120 },
      { key: "pipe_length_ft", name: "Length (ft)", renderEditCell: renderTextEditor, width: 100 },
      { key: "produced_date", name: "Produced Date", renderEditCell: renderTextEditor, width: 120 },
      { key: "repair_amount", name: "Repair Amt", renderEditCell: renderTextEditor, width: 100 },
      { key: "skelp_weld_count", name: "Skelp Welds", renderEditCell: renderTextEditor, width: 100 },
      {
        key: "repair_amount_incl_skelp",
        name: "Repair Amt (B.E.)",
        width: 120,
        renderCell: ({ row }) => <AmountCell value={row.repair_amount_incl_skelp} />,
      },
      {
        key: "repair_ratio",
        name: "Repair Ratio",
        width: 100,
        renderCell: ({ row }) => <RatioCell value={row.repair_ratio} />,
      },
      {
        key: "repair_ratio_incl_skelp",
        name: "Repair Ratio (B.E.)",
        width: 120,
        renderCell: ({ row }) => <RatioCell value={row.repair_ratio_incl_skelp} />,
      },
      { key: "repair_count", name: "Repair Cnt", renderEditCell: renderTextEditor, width: 90 },
    ],
    []
  );

  const additionalPartColumns = useMemo<Column<GridRow>[]>(
    () => [
      { key: "pipe_no", name: "Pipe No", renderEditCell: renderTextEditor, width: 80 },
      { key: "dimensions", name: "Dimensions", renderEditCell: renderTextEditor, width: 120 },
      {
        key: "additional_part_assembled_date",
        name: "Assembled",
        width: 130,
        renderCell: ({ row, onRowChange }) => (
          <DoneDateCell
            value={row.additional_part_assembled_date}
            reportDate={reportDate}
            onChange={(v) => onRowChange({ ...row, additional_part_assembled_date: v })}
            confirmMessage="Remove the Assembled mark? This will also clear the assembled date."
          />
        ),
      },
      {
        key: "additional_part_welded_date",
        name: "Welded",
        width: 130,
        renderCell: ({ row, onRowChange }) => (
          <DoneDateCell
            value={row.additional_part_welded_date}
            reportDate={reportDate}
            onChange={(v) => onRowChange({ ...row, additional_part_welded_date: v })}
            confirmMessage="Remove the Welded mark? This will also clear the welded date."
          />
        ),
      },
    ],
    [reportDate]
  );

  const coatingColumns = useMemo<Column<GridRow>[]>(
    () => [
      { key: "pipe_no", name: "Pipe No", renderEditCell: renderTextEditor, width: 80 },
      { key: "dimensions", name: "Dimensions", renderEditCell: renderTextEditor, width: 120 },
      {
        key: "coating_done",
        name: "Coating",
        width: 130,
        renderCell: ({ row, onRowChange }) => (
          <CoatingCell row={row} reportDate={reportDate} onRowChange={onRowChange} />
        ),
      },
    ],
    [reportDate]
  );

  const shipColumns = useMemo<Column<GridRow>[]>(
    () => [
      { key: "pipe_no", name: "Pipe No", renderEditCell: renderTextEditor, width: 80 },
      { key: "dimensions", name: "Dimensions", renderEditCell: renderTextEditor, width: 120 },
      {
        key: "shipped_date",
        name: "Shipped",
        width: 130,
        renderCell: ({ row, onRowChange }) => (
          <DoneDateCell
            value={row.shipped_date}
            reportDate={reportDate}
            onChange={(v) => onRowChange({ ...row, shipped_date: v })}
            confirmMessage="Remove the Shipped mark? This will also clear the shipped date."
          />
        ),
      },
    ],
    [reportDate]
  );

  // The full, every-column table -- kept for the rare out-of-order
  // correction (e.g. fixing a pipe that shipped before its coating was
  // recorded) that the stage queues above don't surface once a pipe has
  // moved past a stage. Collapsed by default so it doesn't recreate the
  // "wall of columns" problem the queues exist to solve.
  const allColumns = useMemo<Column<GridRow>[]>(() => {
    const base: Column<GridRow>[] = [
      { key: "pipe_no", name: "Pipe No", renderEditCell: renderTextEditor, width: 90 },
      { key: "dimensions", name: "Dimensions", renderEditCell: renderTextEditor, width: 130 },
      { key: "pipe_length_ft", name: "Length (ft)", renderEditCell: renderTextEditor, width: 100 },
      { key: "produced_date", name: "Produced Date", renderEditCell: renderTextEditor, width: 120 },
      {
        key: "status",
        name: "Status",
        width: 110,
        renderEditCell: (props) => <StatusEditor {...props} />,
      },
      { key: "repair_amount", name: "Repair Amt", renderEditCell: renderTextEditor, width: 100 },
      { key: "skelp_weld_count", name: "Skelp Welds", renderEditCell: renderTextEditor, width: 100 },
      {
        key: "repair_amount_incl_skelp",
        name: "Repair Amt (B.E.)",
        width: 120,
        renderCell: ({ row }) => <AmountCell value={row.repair_amount_incl_skelp} />,
      },
      {
        key: "repair_ratio",
        name: "Repair Ratio",
        width: 100,
        renderCell: ({ row }) => <RatioCell value={row.repair_ratio} />,
      },
      {
        key: "repair_ratio_incl_skelp",
        name: "Repair Ratio (B.E.)",
        width: 120,
        renderCell: ({ row }) => <RatioCell value={row.repair_ratio_incl_skelp} />,
      },
      { key: "repair_count", name: "Repair Cnt", renderEditCell: renderTextEditor, width: 90 },
      { key: "repaired_date", name: "Repaired Date", renderEditCell: renderTextEditor, width: 120 },
      {
        key: "features",
        name: "Features",
        width: 180,
        renderCell: ({ row }) => <FeaturesCell row={row} />,
        renderEditCell: (props) => <FeaturesEditor {...props} />,
      },
    ];

    if (config.requires_additional_part) {
      base.push(
        {
          key: "additional_part_assembled_date",
          name: "Assembled",
          width: 130,
          renderCell: ({ row, onRowChange }) => (
            <DoneDateCell
              value={row.additional_part_assembled_date}
              reportDate={reportDate}
              onChange={(v) => onRowChange({ ...row, additional_part_assembled_date: v })}
              confirmMessage="Remove the Assembled mark? This will also clear the assembled date."
            />
          ),
        },
        {
          key: "additional_part_welded_date",
          name: "Welded",
          width: 130,
          renderCell: ({ row, onRowChange }) => (
            <DoneDateCell
              value={row.additional_part_welded_date}
              reportDate={reportDate}
              onChange={(v) => onRowChange({ ...row, additional_part_welded_date: v })}
              confirmMessage="Remove the Welded mark? This will also clear the welded date."
            />
          ),
        }
      );
    }

    if (config.requires_coating) {
      base.push({
        key: "coating_done",
        name: "Coating",
        width: 130,
        renderCell: ({ row, onRowChange }) => (
          <CoatingCell row={row} reportDate={reportDate} onRowChange={onRowChange} />
        ),
      });
    }

    base.push({
      key: "shipped_date",
      name: "Shipped",
      width: 130,
      renderCell: ({ row, onRowChange }) => (
        <DoneDateCell
          value={row.shipped_date}
          reportDate={reportDate}
          onChange={(v) => onRowChange({ ...row, shipped_date: v })}
          confirmMessage="Remove the Shipped mark? This will also clear the shipped date."
        />
      ),
    });

    return base;
  }, [config.requires_additional_part, config.requires_coating, reportDate]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <SummaryCard label="Produced" value={String(summaryStats.producedCount)} />
        <SummaryCard label="Repaired" value={String(summaryStats.repairedCount)} />
        <SummaryCard label="Shipped" value={String(summaryStats.shippedCount)} />
        <SummaryCard
          label="Overall Repair Ratio"
          value={summaryStats.overallRatio != null ? `${(summaryStats.overallRatio * 100).toFixed(2)}%` : "—"}
          accent
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Report Date
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {hasUnsavedChanges ? (
          <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
            ● Unsaved changes
          </span>
        ) : (
          savedAt && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              Saved ({savedAt.toLocaleTimeString()})
            </span>
          )
        )}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>

      {groups.length === 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This project has no groups yet — every pipe must belong to a group.{" "}
          <Link href={`/admin/projects?groupProject=${projectNo}`} className="font-medium underline">
            Add a group on the Projects page
          </Link>{" "}
          before entering pipes.
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-sm text-slate-500">Next pipe: #{nextPipeNo()}</span>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="" disabled>
              Select a group…
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label ?? `Group ${g.id}`} — {g.pipe_length_ft ?? "?"} ft ({g.produced_qty}/{g.planned_qty})
              </option>
            ))}
          </select>
          <button
            onClick={addPipe}
            disabled={selectedGroupId === ""}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      )}

      <StageSection
        title="Awaiting Repair"
        summary={`${repairRows.length} pipe${repairRows.length === 1 ? "" : "s"} awaiting repair`}
        rows={repairRows}
        columns={repairColumns}
        onRowsChange={mergeRows}
        onSave={handleSave}
        saving={saving}
      />
      {config.track_parts_separately ? (
        <PartsChecklistSection
          rows={additionalPartRows}
          partProgressByKey={partProgressByKey}
          reportDate={reportDate}
          onToggle={handlePartProgressToggle}
        />
      ) : (
        <StageSection
          title="Awaiting Additional Part"
          summary={`${additionalPartRows.length} pipe${additionalPartRows.length === 1 ? "" : "s"} awaiting additional part`}
          rows={additionalPartRows}
          columns={additionalPartColumns}
          onRowsChange={mergeRows}
          onSave={handleSave}
          saving={saving}
        />
      )}
      <StageSection
        title="Awaiting Coating"
        summary={`${coatingRows.length} pipe${coatingRows.length === 1 ? "" : "s"} awaiting coating`}
        rows={coatingRows}
        columns={coatingColumns}
        onRowsChange={mergeRows}
        onSave={handleSave}
        saving={saving}
      />
      <StageSection
        title="Awaiting Shipment"
        summary={`${shipRows.length} pipe${shipRows.length === 1 ? "" : "s"} awaiting shipment`}
        rows={shipRows}
        columns={shipColumns}
        onRowsChange={mergeRows}
        onSave={handleSave}
        saving={saving}
      />

      <button
        onClick={() => setShowAllPipes((v) => !v)}
        className="mb-2 text-sm font-medium text-blue-600 hover:underline"
      >
        {showAllPipes ? "Hide All Pipes" : `Show All Pipes (${rows.length})`}
      </button>

      {showAllPipes && (
        <div className="mb-5">
          <div
            className="rdg-light overflow-hidden rounded-xl border border-slate-200"
            style={
              {
                "--rdg-border-color": "#e2e8f0",
                "--rdg-header-background-color": "#f8fafc",
                "--rdg-row-hover-background-color": "#eff6ff",
                "--rdg-selection-color": "#2563eb",
                "--rdg-color": "#1e293b",
                "--rdg-font-size": "13px",
              } as React.CSSProperties
            }
          >
            <DataGrid
              columns={allColumns}
              rows={rows}
              onRowsChange={handleRowsChange}
              rowKeyGetter={(row: GridRow) => row.rowId}
              style={{ blockSize: 480, border: "none" }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {rows.length} pipe{rows.length === 1 ? "" : "s"} total, every field editable — use this to fix
              anything out of order.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {allErrors.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Not saved — these rows were not written to the database, fix the value and save again
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {allErrors.map(([rowId, errors]) => {
              const row = rows.find((r) => r.rowId === rowId);
              return errors.map((e, i) => (
                <li key={`${rowId}-${i}`}>
                  Pipe {row?.pipe_no || "(no.)"}: {e}
                </li>
              ));
            })}
          </ul>
        </div>
      )}

      {allWarnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-700">Warnings — saved, informational only</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {allWarnings.map(([rowId, warnings]) => {
              const row = rows.find((r) => r.rowId === rowId);
              return warnings.map((w, i) => (
                <li key={`${rowId}-${i}`}>
                  Pipe {row?.pipe_no ?? rowId}: {w}
                </li>
              ));
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
