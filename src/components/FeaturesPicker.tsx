"use client";

import { useState } from "react";
import { PRESET_FEATURES } from "@/lib/pipeFeatures";

// Preset checkboxes + a free-text custom entry, shared by the Pipes grid's
// per-row Features cell (PipeGrid.tsx) and the project Groups form
// (projects/GroupForm.tsx) -- deliberately just the picker itself, no
// positioning/chrome, so each caller can wrap it however fits (an
// absolutely-positioned grid-cell popup vs. a plain form field).
export function FeaturesPicker({
  features,
  onChange,
}: {
  features: string[];
  onChange: (next: string[]) => void;
}) {
  const [customText, setCustomText] = useState("");
  const selected = new Set(features);

  function toggle(preset: string) {
    const next = new Set(selected);
    if (next.has(preset)) next.delete(preset);
    else next.add(preset);
    onChange([...next]);
  }

  function addCustom() {
    const value = customText.trim();
    if (!value || selected.has(value)) return;
    onChange([...selected, value]);
    setCustomText("");
  }

  return (
    <div>
      <div className="space-y-1.5">
        {PRESET_FEATURES.map((preset) => (
          <label key={preset} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.has(preset)}
              onChange={() => toggle(preset)}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            {preset}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Custom..."
          className="w-full rounded border border-slate-300 px-1.5 py-1 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded border border-slate-300 px-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          +
        </button>
      </div>
    </div>
  );
}
