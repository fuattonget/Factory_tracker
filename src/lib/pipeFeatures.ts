// Preset pipe features -- confirmed against the real Excel (06-131 sheet
// in dash_app/exam files), not guessed: "CLUTCH" is a named row category
// with its own "Total Clutch/Accessory Completed Process Quantity" count
// and two sub-stages ("Clutch Tack Welding Completed (Montaj)" / "Clutch
// Weld Out Completed (Kaynak)" -- matching this app's own
// additional_part_assembled_date/welded_date naming). "Drive Shoe",
// "Back-Up Ring", and "Fused S. Rings" appear as named quantities under a
// "Ring/Shoe" category header. "Coating" appears as its own named section
// ("Coating Details", "Total Coated Pipe Quantity").
//
// Presets are a starting point, not an exhaustive list -- PRESET_FEATURES
// is exactly what real projects have used so far; anything else goes in
// as free text via the custom option, same as the real sheets do (a
// physical work order can call for something not seen yet).
export const PRESET_FEATURES = [
  "Clutch",
  "Drive Shoe",
  "Back-Up Ring",
  "Fused S. Rings",
  "Coating",
] as const;

export type PresetFeature = (typeof PRESET_FEATURES)[number];
