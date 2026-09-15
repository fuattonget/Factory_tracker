// Colors for the Project Board's pipe tiles (src/app/board/page.tsx) --
// values come straight from the dataviz skill's validated reference
// palette (references/palette.md), never eyeballed. Two independent color
// channels on one tile, confirmed directly by the user from real Excel
// examples:
//   - a CATEGORICAL color per planned group (length/spec batch) so pipes
//     from the same batch are visually clustered on the board, since
//     which group a tile belongs to is identity, not magnitude or state;
//   - a STATUS color for repair/assembly/shipping state (good/warning/
//     critical), which is state, not identity, so it never borrows from
//     the categorical set.
// Both channels always ship with a visible text label alongside the
// color (a percentage, "SHIPPED BARE", etc.) -- required by the palette's
// own contrast notes (warning/serious sit under 3:1 on a light surface by
// design; color is never the only signal).

// Fixed order, 8 hues -- validated as a set (worst adjacent CVD Delta E
// 9.1 light / 8.4 dark). Assigned to groups in creation order, one slot
// per group; cycles past 8 groups in the same project (rare in practice --
// see PROJECT_PLAN.md's real examples, which top out around 6).
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

// A pipe with no group (group_id null -- predates the "every pipe needs a
// group" rule, see PROJECT_PLAN.md section 5) gets neutral gray instead of
// a real categorical slot, since "no group" isn't a category of its own.
export const NO_GROUP_COLOR = "#898781"; // palette.md's "muted" ink

export function colorForGroupIndex(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

// Fixed, reserved meaning -- never themed, never reused for identity. See
// palette.md's Status palette table.
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;
