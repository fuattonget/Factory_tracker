# Reference Excel files

Real daily report files, copied (read-only, `dash_app` untouched) from
`dash_app/exam files/` for grounding the data model in actual data. See
`../PROJECT_PLAN.md` section 5 for the pipe lifecycle model these sheets
are meant to inform.

- `Daily Activity Tracking Report - 2026 9.4.26.xlsx` — the most recent
  known-clean daily file as of the planning session. Good general-purpose
  reference for sheet/block structure.
- `Daily Activity Tracking Report - 2026 8.28.26.xlsx` — one of the two
  files involved in the out-of-order-upload bug described in
  `PROJECT_PLAN.md` section 1 (uploaded *after* the 8.29 file, which is
  what caused the regression). Kept as a concrete example of the kind of
  real-world entry-timing mess-up the new system's entry form needs to
  make structurally impossible.

Each project sheet (e.g. `01-118`, `06-131`) is a large grid of repeating
"pipe blocks." Each block has an anchor cell containing text starting with
`"Repair ... Rate :"` (or, on a couple of sheets, a broken variant like
`"Repair R: 3.79%"` — see `PROJECT_PLAN.md` for why that broke the old
parser), with the pipe number, length, repair amount, category, surface
state, and (per section 5) probably some of the not-yet-decoded
tooling/stage/position fields nearby, at offsets that vary by sheet
template. There's no need to hand-parse these with `openpyxl` from
scratch — `dash_app/project_parser.py` (read-only reference, don't import
or run it from this project) already has working extraction logic for the
fields it does capture, useful as a reference for the block layout even
though this project won't reuse Python code directly.
