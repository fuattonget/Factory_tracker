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
    <input
      type="checkbox"
      checked={row.coating_done}
      onChange={(e) => onRowChange({ ...row, coating_done: e.target.checked })}
    />
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
      style={{ width: "100%", height: "100%" }}
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
      results.forEach((r: { ok: boolean; warnings?: string[]; error?: string }, i: number) => {
        const rowId = payload[i].rowId;
        if (r.ok) {
          if (r.warnings && r.warnings.length > 0) nextWarnings[rowId] = r.warnings;
        } else {
          nextWarnings[rowId] = [`Kaydedilemedi: ${r.error}`];
        }
      });
      setWarningsByRow(nextWarnings);
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const allWarnings = Object.entries(warningsByRow);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <button onClick={addRow}>+ Yeni satır</button>
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {savedAt && <span style={{ color: "#2a2" }}>Kaydedildi ({savedAt.toLocaleTimeString()})</span>}
        {saveError && <span style={{ color: "crimson" }}>{saveError}</span>}
      </div>

      <DataGrid
        columns={columns}
        rows={rows}
        onRowsChange={handleRowsChange}
        rowKeyGetter={(row: GridRow) => row.rowId}
        style={{ blockSize: 480 }}
      />

      {allWarnings.length > 0 && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fff8e1", border: "1px solid #e0c060" }}>
          <strong>Uyarılar (kayıt engellenmedi, sadece bilgi amaçlı):</strong>
          <ul>
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
