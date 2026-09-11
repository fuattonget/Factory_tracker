"use client";

import { useState, useMemo } from "react";
import { DataGrid, renderTextEditor, type Column, type RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { Pipe, PipeInput, ProjectStageConfig } from "@/lib/types";

// Everything in the grid is a string (text-editor cells) or boolean
// (checkbox cells) -- converted to a real PipeInput only on save. Keeps
// every cell freely editable/blank while typing, which a strict numeric
// type wouldn't allow.
interface GridRow {
  rowId: string; // client-only key, stable across edits
  pipe_no: string;
  dimensions: string;
  pipe_length_ft: string;
  produced_date: string;
  status: "Produced" | "Repaired";
  repair_amount: string;
  repair_ratio: string;
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
    repair_ratio: p.repair_ratio?.toString() ?? "",
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
  };
}

function emptyRow(): GridRow {
  return {
    rowId: `new-${crypto.randomUUID()}`,
    pipe_no: "",
    dimensions: "",
    pipe_length_ft: "",
    produced_date: "",
    status: "Produced",
    repair_amount: "",
    repair_ratio: "",
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
  };
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
    repair_ratio: numOrNull(row.repair_ratio),
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

export function PipeGrid({
  projectNo,
  config,
  initialPipes,
}: {
  projectNo: string;
  config: ProjectStageConfig;
  initialPipes: Pipe[];
}) {
  const [rows, setRows] = useState<GridRow[]>(() => initialPipes.map(pipeToRow));
  const [saving, setSaving] = useState(false);
  const [warningsByRow, setWarningsByRow] = useState<Record<string, string[]>>({});
  const [errorsByRow, setErrorsByRow] = useState<Record<string, string[]>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

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
      { key: "repair_ratio", name: "Repair Ratio", renderEditCell: renderTextEditor, width: 100 },
      { key: "repair_count", name: "Repair Cnt", renderEditCell: renderTextEditor, width: 90 },
      { key: "repair_category", name: "Category", renderEditCell: renderTextEditor, width: 100 },
      { key: "surface_state", name: "Surface", renderEditCell: renderTextEditor, width: 100 },
      { key: "repaired_date", name: "Repaired Date", renderEditCell: renderTextEditor, width: 120 },
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

  function addRow() {
    setRows((r) => [...r, emptyRow()]);
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
      const { results } = await res.json();

      const nextWarnings: Record<string, string[]> = {};
      const nextErrors: Record<string, string[]> = {};
      results.forEach((r: { ok: boolean; warnings?: string[]; error?: string }, i: number) => {
        const rowId = payload[i].rowId;
        if (r.ok) {
          if (r.warnings && r.warnings.length > 0) nextWarnings[rowId] = r.warnings;
        } else {
          nextErrors[rowId] = [r.error ?? "Bilinmeyen hata"];
        }
      });
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
