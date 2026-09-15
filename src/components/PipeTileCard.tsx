import type { BoardTile, FeatureState } from "@/lib/board";
import { STATUS, contrastTextColor } from "@/lib/palette";

// Two independent, status-only colors ("done"/"in_progress") -- see the
// FeatureState doc in lib/board.ts for why "pending" isn't one of them
// (it borrows the tile's own group color instead, so an untouched
// feature reads as identity, not alarm).
const FEATURE_STATE_COLOR: Record<Exclude<FeatureState, "pending">, string> = {
  done: STATUS.good,
  in_progress: STATUS.critical,
};

// One row per feature (not a side-by-side flex row) -- with 2-3 features
// sharing a ~110px tile, splitting the width truncated names like
// "Back-Up Ring" down to "Back-U...". Stacking keeps the full label
// readable regardless of how many features a pipe has.
function FeatureCell({ feature, state, groupColor }: { feature: string; state: FeatureState; groupColor: string }) {
  const bg = state === "pending" ? groupColor : FEATURE_STATE_COLOR[state];
  return (
    <div
      className="truncate px-1.5 py-1 text-center text-[10px] font-bold leading-tight"
      style={{ backgroundColor: bg, color: contrastTextColor(bg) }}
      title={feature}
    >
      {feature}
    </div>
  );
}

// One pipe (or one still-planned slot), as a status tile -- ports
// PROJECT_PLAN.md section 5's "screenshot" description and several real
// Excel examples shown directly by the user. Three independent color
// channels, deliberately kept separate rather than collapsed into one:
//   - groupColor (categorical, see lib/palette.ts): which planned batch
//     this pipe belongs to -- the header bar and left border.
//   - feature-band colors (status): each feature's own assembly progress.
//   - the big pipe number (status): repair progress -- red until a
//     repair amount is recorded, green after.
// Shipped pipes get a yellow tile body (confirmed directly by the user,
// "shipleri sarı ile gösteriyoruz") -- independent of both of the above.
// A still-planned pipe (not yet produced) renders the same template with
// the number/amount left blank (confirmed directly by the user) -- the
// header and feature band still show, since those describe the *plan*,
// not this specific unit's progress.
export function PipeTileCard({ tile }: { tile: BoardTile }) {
  const isPlanned = tile.kind === "planned";
  const repaired = tile.kind === "pipe" && tile.repaired;
  const numberColor = repaired ? STATUS.good : STATUS.critical;
  const bodyBg = tile.kind === "pipe" && tile.shipped ? "#fff7cc" : "#ffffff"; // pale yellow when shipped

  return (
    <div
      className="overflow-hidden rounded-xl border-2 text-center shadow-sm"
      style={{ borderColor: tile.groupColor }}
    >
      <div
        className="px-1.5 py-1.5 text-[11px] font-semibold text-slate-900"
        style={{ backgroundColor: `${tile.groupColor}26` /* ~15% tint, keeps text readable */ }}
      >
        Repair Rate:{" "}
        <span className="tabular-nums">
          {tile.kind === "pipe" && tile.repair_ratio != null ? `${(tile.repair_ratio * 100).toFixed(2)}%` : "0.00%"}
        </span>
      </div>

      {tile.features.length > 0 && (
        <div className="flex flex-col divide-y divide-black/10 border-t border-black/10">
          {tile.features.map((f) => (
            <FeatureCell key={f.feature} feature={f.feature} state={f.state} groupColor={tile.groupColor} />
          ))}
        </div>
      )}

      <div className="flex border-t border-black/10">
        <div
          className="flex w-5 shrink-0 items-center justify-center text-[10px] font-semibold text-slate-500"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {tile.pipe_length_ft != null ? `${tile.pipe_length_ft} ft` : ""}
        </div>
        <div className="flex flex-1 items-center justify-center py-2.5" style={{ backgroundColor: bodyBg }}>
          {!isPlanned && tile.kind === "pipe" && (
            <span className="text-2xl font-bold tabular-nums" style={{ color: numberColor }}>
              {tile.pipe_no}
            </span>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between border-t border-black/10 px-1.5 py-1 text-[10px]"
        style={{ backgroundColor: bodyBg }}
      >
        <span className="font-semibold tabular-nums" style={{ color: repaired ? STATUS.good : "#94a3b8" }}>
          {tile.kind === "pipe" ? (tile.repair_amount_incl_skelp_m ?? 0).toFixed(2) : ""}{" "}m.
        </span>
        <span className="font-medium text-slate-500">B.E</span>
      </div>

      {tile.kind === "pipe" && tile.band && (() => {
        const bandBg = tile.band === "Coating" ? "#2a78d6" : STATUS.warning;
        return (
          <div
            className="py-1 text-[10px] font-bold tracking-wide"
            style={{ backgroundColor: bandBg, color: contrastTextColor(bandBg) }}
          >
            {tile.band === "Coating" ? "COATING" : "SHIPPED BARE"}
          </div>
        );
      })()}
    </div>
  );
}
