"use client";

import { useState, useMemo } from "react";
import { DataGrid, renderTextEditor, type Column, type RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { Pipe, PipeInput, ProjectStageConfig } from "@/lib/types";
import type { ProjectPipeGroupProgress } from "@/lib/pipes";
import { formatDimensions } from "@/lib/pipes";
import { FeaturesPicker } from "@/components/FeaturesPicker";

// Everything in the grid is a string (text-editor cells) or boolean
// (checkbox cells) -- converted to a real PipeInput only on save. Keeps
// every cell freely editable/blank while typing, which a strict numeric
// type wouldn't allow. features stays a real string[] since it has its
// own picker editor, not a text editor. repair_ratio(_incl_skelp) are
// display-only strings, refreshed from the server's response after each
// save -- see handleSave -- never sent back as input (PipeInput doesn't
// even have a slot for them, see lib/types.ts).
interface GridRow {
  rowId: string; // client-only key, stable across edits
  pipe_no: string;
  dimensions: string;
  pipe_length_ft: string;
  produced_date: string;
  status: "Produced" | "Repaired";
  repair_amount: string;
  repair_amount_incl_skelp: string;
  repair_ratio: string;
  repair_ratio_incl_skelp: string;
  repair_count: string;
  repair_category: string;
  surface_state: string;
  repaired_date: string;
  additional_part_name: string;
  additional_part_qty: string;
  additional_part_assembled_date: string;
  additional_part_welded_date: string;
  coating_done: boolean;
  coating_date: string;
  shipped_date: string;
  features: string[];
  // Set when this row was bulk-added from a predefined project group --
  // see the "Gruptan ekle" picker below. Null for ad-hoc rows.
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
    repair_amount_incl_skelp: p.repair_amount_incl_skelp?.toString() ?? "",
    repair_ratio: p.repair_ratio?.toString() ?? "",
    repair_ratio_incl_skelp: p.repair_ratio_incl_skelp?.toString() ?? "",
    repair_count: p.repair_count?.toString() ?? "",
    repair_category: p.repair_category ?? "",
    surface_state: p.surface_state ?? "",
    repaired_date: p.repaired_date ?? "",
    additional_part_name: p.additional_part_name ?? "",
    additional_part_qty: p.additional_part_qty?.toString() ?? "",
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
    repair_amount_incl_skelp: "",
    repair_ratio: "",
    repair_ratio_incl_skelp: "",
    repair_count: "",
    repair_category: "",
    surface_state: "",
    repaired_date: "",
    additional_part_name: "",
    additional_part_qty: "",
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
    repair_amount_incl_skelp: numOrNull(row.repair_amount_incl_skelp),
    repair_count: numOrNull(row.repair_count) as number | null,
    repair_category: strOrNull(row.repair_category),
    surface_state: strOrNull(row.surface_state),
    repaired_date: strOrNull(row.repaired_date),
    status: row.status,
    additional_part_name: strOrNull(row.additional_part_name),
    additional_part_qty: numOrNull(row.additional_part_qty) as number | null,
    additional_part_assembled_date: strOrNull(row.additional_part_assembled_date),
    additional_part_welded_date: strOrNull(row.additional_part_welded_date),
    coating_done: row.coating_done,
    coating_date: strOrNull(row.coating_date),
    shipped_date: strOrNull(row.shipped_date),
    features: row.features,
    group_id: row.group_id,
  };
}

function CheckboxCell({ row, onRowChange }: { row: GridRow; onRowChange: (r: GridRow) => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <input
        type="checkbox"
        checked={row.coating_done}
        onChange={(e) => onRowChange({ ...row, coating_done: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
      />
    </div>
  );
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
        Tamam
      </button>
    </div>
  );
}

// repair_ratio(_incl_skelp) are never typed in -- the admin only enters a
// repair amount (meters), the ratio is computed server-side from that
// amount plus the project's diameter/band_width (see computeRepairRatio in
// lib/pipes.ts). Read-only display cell, percent-formatted.
function RatioCell({ value }: { value: string }) {
  const n = Number(value);
  const display = value.trim() !== "" && Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : null;
  return (
    <div className="flex h-full items-center justify-end px-2 tabular-nums text-slate-500">
      {display ?? <span className="text-slate-300">—</span>}
    </div>
  );
}

interface SaveResult {
  ok: boolean;
  pipe?: Pipe;
  warnings?: string[];
  error?: string;
}

export function PipeGrid({
  projectNo,
  config,
  initialPipes,
  groups,
}: {
  projectNo: string;
  config: ProjectStageConfig;
  initialPipes: Pipe[];
  groups: ProjectPipeGroupProgress[];
}) {
  const [rows, setRows] = useState<GridRow[]>(() => initialPipes.map(pipeToRow));
  const [saving, setSaving] = useState(false);
  const [warningsByRow, setWarningsByRow] = useState<Record<string, string[]>>({});
  const [errorsByRow, setErrorsByRow] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const defaultDimensions = formatDimensions(config.diameter, config.wall_thickness) ?? "";

  // The daily-entry "Rapor Tarihi" -- stamps produced_date for every new
  // row added below (single or bulk), defaulting to yesterday since a
  // report entered today covers yesterday's floor activity (confirmed
  // directly by the user). Stays editable per row afterward for correction.
  const [reportDate, setReportDate] = useState(yesterdayISO);

  const [bulkQty, setBulkQty] = useState("5");
  const [bulkLength, setBulkLength] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  function handleGroupSelect(id: string) {
    setSelectedGroupId(id);
    if (id === "") return; // "— Manuel —": leave qty/length as the admin last set them
    const group = groups.find((g) => String(g.id) === id);
    if (!group) return;
    const remaining = Math.max(0, group.planned_qty - group.produced_qty);
    setBulkQty(String(remaining));
    setBulkLength(group.pipe_length_ft?.toString() ?? "");
  }

  const columns = useMemo<Column<GridRow>[]>(() => {
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
      { key: "repair_amount_incl_skelp", name: "Repair Amt (B.E.)", renderEditCell: renderTextEditor, width: 120 },
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
      { key: "repair_category", name: "Category", renderEditCell: renderTextEditor, width: 100 },
      { key: "surface_state", name: "Surface", renderEditCell: renderTextEditor, width: 100 },
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
        { key: "additional_part_name", name: "Add'l Part", renderEditCell: renderTextEditor, width: 130 },
        { key: "additional_part_qty", name: "Part Qty", renderEditCell: renderTextEditor, width: 90 },
        { key: "additional_part_assembled_date", name: "Assembled", renderEditCell: renderTextEditor, width: 120 },
        { key: "additional_part_welded_date", name: "Welded", renderEditCell: renderTextEditor, width: 120 }
      );
    }

    if (config.requires_coating) {
      base.push(
        {
          key: "coating_done",
          name: "Coating Done",
          width: 100,
          renderCell: ({ row, onRowChange }) => <CheckboxCell row={row} onRowChange={onRowChange} />,
          renderEditCell: undefined,
        },
        { key: "coating_date", name: "Coating Date", renderEditCell: renderTextEditor, width: 120 }
      );
    }

    base.push({ key: "shipped_date", name: "Shipped Date", renderEditCell: renderTextEditor, width: 120 });

    return base;
  }, [config.requires_additional_part, config.requires_coating]);

  function handleRowsChange(newRows: GridRow[], _data: RowsChangeData<GridRow>) {
    setRows(newRows);
  }

  function nextPipeNo(): number {
    const nums = rows.map((r) => Number(r.pipe_no)).filter((n) => Number.isFinite(n) && n > 0);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }

  function addRow() {
    setRows((r) => [
      ...r,
      emptyRow({ pipe_no: String(nextPipeNo()), dimensions: defaultDimensions, produced_date: reportDate }),
    ]);
  }

  // "5 tane 77 feet boru ekle" -- bulk-add N pipes of the same length in
  // one go, auto-numbered from the next free pipe number, so a whole work
  // order's worth of identical-length pipes doesn't need typing one row at
  // a time. Picking a predefined group (see handleGroupSelect) pre-fills
  // qty/length from it and stamps every new row with that group's features
  // + group_id for progress tracking; "— Manuel —" leaves those blank.
  function addBulkRows() {
    const qty = Math.trunc(Number(bulkQty));
    if (!Number.isFinite(qty) || qty <= 0) return;
    const group = groups.find((g) => String(g.id) === selectedGroupId) ?? null;
    let nextNo = nextPipeNo();
    const newRows: GridRow[] = [];
    for (let i = 0; i < qty; i++) {
      newRows.push(
        emptyRow({
          pipe_no: String(nextNo++),
          dimensions: defaultDimensions,
          pipe_length_ft: bulkLength.trim(),
          produced_date: reportDate,
          features: group?.features ?? [],
          group_id: group?.id ?? null,
        })
      );
    }
    setRows((r) => [...r, ...newRows]);
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
      results.forEach((r, i) => {
        const rowId = payload[i].rowId;
        if (r.ok && r.pipe) {
          if (r.warnings && r.warnings.length > 0) nextWarnings[rowId] = r.warnings;
          // Replace the local row with the server's version (real id,
          // computed repair_ratio(_incl_skelp), derived shipped_bare) so
          // the computed ratio shows up immediately, without a reload.
          const idx = nextRows.findIndex((row) => row.rowId === rowId);
          if (idx !== -1) nextRows[idx] = { ...pipeToRow(r.pipe), rowId };
        } else {
          nextErrors[rowId] = [r.error ?? "Bilinmeyen hata"];
        }
      });
      setRows(nextRows);
      setWarningsByRow(nextWarnings);
      setErrorsByRow(nextErrors);
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const allWarnings = Object.entries(warningsByRow);
  const allErrors = Object.entries(errorsByRow);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Rapor Tarihi
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <button
          onClick={addRow}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          + Yeni satır
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {savedAt && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            Kaydedildi ({savedAt.toLocaleTimeString()})
          </span>
        )}
        {saveError && <span className="text-sm text-red-600">{saveError}</span>}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {groups.length > 0 && (
          <label className="flex flex-col text-xs text-slate-500">
            Gruptan ekle
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupSelect(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
            >
              <option value="">— Manuel —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label ?? `Grup ${g.id}`} ({g.produced_qty}/{g.planned_qty})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col text-xs text-slate-500">
          Kaç boru
          <input
            type="number"
            min={1}
            value={bulkQty}
            onChange={(e) => setBulkQty(e.target.value)}
            className="mt-1 w-20 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Uzunluk (ft)
          <input
            type="number"
            step="any"
            value={bulkLength}
            onChange={(e) => setBulkLength(e.target.value)}
            placeholder="örn. 77"
            className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <button
          onClick={addBulkRows}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Toplu ekle
        </button>
        <span className="pb-1.5 text-xs text-slate-400">
          Pipe No otomatik devam eder, Produced Date Rapor Tarihi olarak dolar — grid&apos;de düzenlenebilir.
        </span>
      </div>

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
          onRowsChange={handleRowsChange}
          rowKeyGetter={(row: GridRow) => row.rowId}
          style={{ blockSize: 480, border: "none" }}
        />
      </div>

      {allErrors.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Kaydedilmedi — bu satırlar veritabanına yazılmadı, değeri düzeltip tekrar kaydedin
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
          <p className="text-sm font-semibold text-amber-700">Uyarılar — kaydedildi, sadece bilgi amaçlı</p>
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
