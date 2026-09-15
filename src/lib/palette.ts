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

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Picks whichever of black/white ink wins the WCAG contrast race against a
// given fill -- computed per color instead of hand-picked, since tile bands
// pair every categorical AND status hue (8 + 4 fixed values, all fair game)
// with a solid label. White-on-everything (the board's original approach)
// silently fails contrast on the lighter half of the palette (e.g. white on
// STATUS.warning is ~1.8:1) -- this is what actually fixes that.
export function contrastTextColor(hex: string): "#0f172a" | "#ffffff" {
  return relativeLuminance(hex) > 0.179 ? "#0f172a" : "#ffffff";
}
