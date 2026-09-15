import type { PipeTile } from "@/lib/board";

const BAND_STYLE: Record<NonNullable<PipeTile["band"]>, string> = {
  Coating: "bg-blue-100 text-blue-700",
  "Shipped Bare": "bg-red-100 text-red-800",
};

// One pipe, as a colored status tile -- see PROJECT_PLAN.md section 5's
// "screenshot" description this ports: pipe number colored red (not yet
// repaired) or green (repaired), a repair-rate label, an optional colored
// category band ("Coating" / "Shipped Bare"), and the length. A plain
// tile with no band can still have shipped -- Shipped is tracked
// independently of the Coating/Shipped-Bare distinction (confirmed
// directly by the user), so it gets its own small marker when there's no
// band to carry it.
export function PipeTileCard({ tile }: { tile: PipeTile }) {
  const colorClasses = tile.repaired
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`flex flex-col items-center rounded-xl border p-2.5 ${colorClasses}`}>
      <span className="text-lg font-bold tabular-nums">{tile.pipe_no}</span>
      <span className="text-xs font-medium tabular-nums">
        {tile.repair_ratio != null ? `${(tile.repair_ratio * 100).toFixed(2)}%` : "0.00%"}
      </span>
      {tile.band && (
        <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BAND_STYLE[tile.band]}`}>
          {tile.band}
        </span>
      )}
      {!tile.band && tile.shipped && (
        <span className="mt-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          Shipped
        </span>
      )}
      {tile.pipe_length_ft != null && (
        <span className="mt-1 text-[10px] text-slate-500">
          {tile.pipe_length_ft} ft ({tile.pipe_length_m?.toFixed(1)} m)
        </span>
      )}
    </div>
  );
}
