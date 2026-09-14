"use client";

import { useState, useTransition } from "react";
import { FeaturesPicker } from "@/components/FeaturesPicker";
import { saveProjectPipeGroup, removeProjectPipeGroup } from "./actions";
import type { ProjectPipeGroupProgress } from "@/lib/pipes";

// Planned sub-groups within a project's total pipe count (e.g. "Grup 1:
// 10 pipes, 55ft, has Clutch") -- see supabase/schema.sql's
// project_pipe_groups comment. Called as typed Server Actions directly
// (see actions.ts) rather than a <form action=...> since features: string[]
// lives in this component's React state via the shared FeaturesPicker.
export function GroupsManager({
  projectNo,
  groups,
}: {
  projectNo: string;
  groups: ProjectPipeGroupProgress[];
}) {
  const [label, setLabel] = useState("");
  const [plannedQty, setPlannedQty] = useState("");
  const [pipeLengthFt, setPipeLengthFt] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setLabel("");
    setPlannedQty("");
    setPipeLengthFt("");
    setFeatures([]);
  }

  function handleAdd() {
    setError(null);
    const qty = Math.trunc(Number(plannedQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Planlanan adet pozitif bir sayı olmalı.");
      return;
    }
    startTransition(async () => {
      try {
        await saveProjectPipeGroup({
          project_no: projectNo,
          label: label.trim() || null,
          planned_qty: qty,
          pipe_length_ft: pipeLengthFt.trim() === "" ? null : Number(pipeLengthFt),
          features,
        });
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleRemove(id: number) {
    startTransition(async () => {
      await removeProjectPipeGroup(id);
    });
  }

  return (
    <div>
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400">Bu projede henüz grup tanımlanmadı.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-slate-800">{g.label ?? `Grup ${g.id}`}</span>
                <span className="ml-2 text-slate-500">
                  {g.produced_qty}/{g.planned_qty} üretildi
                  {g.pipe_length_ft != null ? ` — ${g.pipe_length_ft} ft` : ""}
                  {g.features.length > 0 ? ` — ${g.features.join(", ")}` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(g.id)}
                disabled={isPending}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Yeni grup ekle
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-slate-500">
            Etiket (ops.)
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Grup 1"
              className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Planlanan adet
            <input
              type="number"
              min={1}
              value={plannedQty}
              onChange={(e) => setPlannedQty(e.target.value)}
              className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Uzunluk (ft)
            <input
              type="number"
              step="any"
              value={pipeLengthFt}
              onChange={(e) => setPipeLengthFt(e.target.value)}
              className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Grup ekle
          </button>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-500">Özellikler</p>
          <FeaturesPicker features={features} onChange={setFeatures} />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
