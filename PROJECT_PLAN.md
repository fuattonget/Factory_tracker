# Factory Tracker — Project Plan & Context

This document is the single source of truth for why this project exists and
what it needs to become. It was written after an extended session working on
the sibling project `dash_app` (a Python/Dash quality-control tool at
`c:\Users\FUATTONGET\Desktop\Projects\dash_app`), during which a long series
of real data-integrity bugs were found and fixed — all traceable to the same
root cause. Read this whole file before writing code; it captures decisions
and reasoning that took a very long conversation to arrive at, so they don't
have to be re-derived.

**Hard constraint, non-negotiable: `dash_app` must never be modified, run,
or put at risk by anything done in this project.** This is a completely
separate codebase. The only thing the two projects ever share is the same
live Supabase database — never code, config, or deployment. If you ever find
yourself about to edit a file under `dash_app`, stop — that's wrong.

## Table of contents

1. [Why this project exists](#1-why-this-project-exists)
2. [What already exists (`dash_app`) and what's being kept](#2-what-already-exists-dash_app-and-whats-being-kept)
3. [Recommended architecture](#3-recommended-architecture)
4. [Data-entry UI direction — Excel-like grid](#4-data-entry-ui-direction--excel-like-grid)
5. [The pipe lifecycle model](#5-the-pipe-lifecycle-model)
6. [What the admin data-entry form must prevent](#6-what-the-admin-data-entry-form-must-prevent)
7. [Phased roadmap](#7-phased-roadmap)
8. [Open decisions — not yet resolved](#8-open-decisions--not-yet-resolved)
9. [Reference material in this repo](#9-reference-material-in-this-repo)
10. [Verification approach](#10-verification-approach)

---

## 1. Why this project exists

`dash_app` ingests daily factory-floor activity by having someone fill in a
large Excel workbook (`Daily Activity Tracking Report - 2026 *.xlsx`) every
day, which then gets uploaded and parsed. Over one long working session, a
long chain of real, concrete bugs was found — every single one traces back
to the fact that **Excel has no way to enforce the invariants this system
actually needs**:

- A single mistyped cell (`M35`, "Total Repair Amount incl. Skelp" entered
  smaller than the base "Total Repair Amount") blocked an entire day's
  import with a validation error, for one unrelated project's row.
- A pipe block's anchor cell (the cell whose text `"Repair ... Rate :"`
  the parser uses to even recognize "a pipe exists here") got accidentally
  blanked to a single space character by whoever was editing the sheet —
  making that one pipe (block `AJ156`, pipe #363 on project `01-118`)
  completely invisible to the parser. It had to be manually re-inserted
  into the database, and the underlying cause (the blank cell) could only
  be fixed by editing the *source Excel* directly, because a blank/space
  cell has no distinguishing signal a parser can safely generalize on
  without risking false positives elsewhere in the sheet.
- The same anchor-label idea broke a *different* way on a different sheet:
  several blocks had their anchor formula rewritten to
  `="Repair R: " & TEXT(ratio, "0.00%")`, which *always* evaluates to text
  (e.g. `"Repair R: 3.79%"`) regardless of repair state — again invisible
  to the parser until specifically patched for that exact format.
- Two daily files got uploaded **out of order** (`2026-08-29`'s file
  uploaded before `2026-08-28`'s). Under the original upsert logic, this
  silently: (a) gave 19 pipes the wrong `first_seen_date` (29th instead of
  the true 28th), (b) gave 20 already-repaired pipes the wrong
  `repaired_date`, and worst of all (c) **regressed 13 pipes that had
  genuinely transitioned Produced→Repaired on the 29th back to "Produced,"
  silently wiping their repair data**, because the second (older, 28th)
  upload's "not yet repaired as of the 28th" data overwrote the newer
  state with no protection. All 52 affected records needed individual
  manual correction after being found via careful cross-referencing
  against the actual dated Excel files. The upsert logic in `dash_app` was
  eventually rewritten to be order-independent (see
  `database.py:upsert_pipe_repair_details` in that repo if you want the
  exact fix — not relevant to port, since the new system won't have an
  "upload order" concept at all: every entry is timestamped by when it was
  actually saved).
- The main summary table ("Daily Repair Rate" sheet) has **fixed-size
  row ranges** per section (25 rows for Coil, 10 for Plate) hardcoded in
  the parser. Adding enough new projects can silently push existing ones
  past the boundary with zero error — verified this was *about* to happen
  (a section was found sitting at exactly 25/25 capacity) before it caused
  real data loss.

None of these are exotic edge cases — they're the *normal, expected*
failure modes of "many people editing a large shared spreadsheet by hand,
every day, for months." A real data-entry system with field-level
validation, real primary keys instead of spreadsheet-coordinate inference,
and no concept of "file upload order" cannot produce any of them.

## 2. What already exists (`dash_app`) and what's being kept

`dash_app` is a working, verified-clean Python/Dash application:

- **Data layer**: Supabase (Postgres). Tables: `repair_rates` (daily
  project-level summary — qty, lengths, repair amounts/ratios, status),
  `pipe_repair_details` (one row per physical pipe, keyed by
  `project_sheet + block_cell`, tracking `first_seen_date`,
  `last_updated_date`, `repair_amount`, `repair_ratio`, `repair_count`,
  `repair_category`, `surface_state`, `status`, `repaired_date`),
  `project_sheet_links` (maps a raw Excel sheet name to a clean
  `project_no` + `dimensions`, plus a `status` and a `dates_reliable` flag
  for excluding known-bad-data projects from cross-project aggregates),
  `historical_baselines`, `project_group_configs`.
- **Views**: a Dashboard (trend charts, backlog/stock tracking, Pareto
  charts, a "Newest Produced/Repaired Pipes" pair of tables), a Pipe
  Analysis tab (per-project trend, a day-colored pipe sequence chart,
  worst-pipes chart, box plots), a Comparison tab (multi-project), PDF
  export for both the Dashboard and a single project's Pipe Analysis, and
  a separate "Data Conversion" module that ingests coil-certificate PDFs/
  Excels from suppliers and reformats them (unrelated to the daily
  tracking flow, lowest priority to port).
- **This is all staying, unchanged, as a live fallback.** This new project
  does **not** replace `dash_app` on day one — it runs alongside it,
  reading/writing the *same* Supabase project, until feature parity is
  reached and the team is comfortable relying on it. `dash_app`'s Import
  tab (the Excel upload flow) is the thing this project is meant to
  eventually make unnecessary — not `dash_app` itself.

**Decision: don't migrate the data.** Point this project at the exact same
Supabase project `dash_app` uses. That data just went through an entire
session of verification (a full 2954-pipe reconciliation against the real
source Excel, individually-corrected records, an order-independent upsert
rewrite). Standing up a second database and exporting/importing into it
would be pure risk for zero benefit.

## 3. Recommended architecture

- **Framework**: Next.js (App Router, TypeScript). Already scaffolded in
  this repo (`create-next-app`, Tailwind, ESLint, `src/` dir, `@/*` import
  alias).
- **Hosting**: Vercel (confirmed by the user) — zero-config Next.js
  deploys, no reason to juggle another platform for this app.
- **Database access pattern**: server-side only. Every page/route that
  reads or writes data does so from a Server Component, Route Handler, or
  Server Action, using the Supabase **service role** key — the same
  security model `dash_app` already uses (a pure backend, key never
  reaches a browser). This avoids having to design/audit Row Level
  Security policies for anonymous/public read access before shipping
  anything — the public viewing pages fetch data server-side and render
  static/SSR'd HTML, the client never talks to Supabase directly for data.
  Keep the actual key in `.env.local` (gitignored) — **never** commit it,
  and never paste the literal secret into a markdown file like this one.
  Get the value from `dash_app`'s own `.env` (`SUPABASE_URL` /
  `SUPABASE_KEY`) or the Supabase project dashboard — it's the *same*
  Supabase project, so it's the *same* credentials.
- **Auth** (admin panel only): Supabase Auth, email/password is enough for
  a small number of named admin users. Gate `/admin/*` routes via Next.js
  middleware checking the Supabase session. The public viewing pages need
  **no auth at all** — matches `dash_app` today (an open link, no login).
  Supabase Auth itself is fine to use with the public anon key client-side
  (that's what it's designed for) — this is the one place a
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` is legitimately needed; data queries
  still never use the anon key.
- **Charts**: `react-plotly.js`. `dash_app`'s charts (in
  `pages/home.py`) already have a lot of considered design in them — an
  Okabe-Ito colorblind-safe day-coloring scheme for the pipe sequence
  chart, specific hover templates, legend positioning fixes, a
  `PIPE_TREND_FLOOR_DATE` cutoff for excluding unreliable legacy dates,
  Net/Stock consistency in the backlog chart. Porting the *exact* trace/
  layout configs to Plotly.js is translation work, not redesign — reuse
  the decisions already made, don't re-litigate chart design from
  scratch.
- **PDF export**: a Node pipeline (headless-Chromium print-to-PDF of a
  print-styled report page is the closest direct port of what
  `pdf_report.py` + matplotlib/reportlab does today). Low priority —
  see roadmap.

## 4. Data-entry UI direction — Excel-like grid

The field team already thinks in Excel's grid layout. The admin data-entry
form should **look and behave like a spreadsheet** — an editable data-grid
component (rows = pipes, columns = fields), not a traditional
one-field-at-a-time form. This is both a familiarity win (less retraining)
and a speed win (bulk/keyboard/paste-friendly entry for dozens-to-hundreds
of pipes per project per day). Validation (section 6) surfaces as inline
cell highlighting, not a blocking modal — invalid data should be visible
and correctable in place, the same way a typo is visible in Excel.

A real project board view (see `reference-excel/`, and the description in
section 5) shows the kind of at-a-glance visual the team is used to: pipe
numbers colored by status (red = not yet repaired, green = repaired),
grouped into a grid, with category/stage bands per pipe. The new UI doesn't
need to be a pixel-identical copy of that layout, but it should preserve
the *at-a-glance, color-coded, grid-shaped* feel — that visual language is
already proven to work for this team.

## 5. The pipe lifecycle model

**This is the most important, and least finalized, part of the whole
project — read carefully, and don't guess past what's written here.**

The current `dash_app` schema tracks a pipe with a single binary status:
`"Produced"` (cut, not yet repaired) → `"Repaired"` (has repair data). The
real factory process is a **longer sequence of largely-independent
stages**, described directly by the person running this project (quoted/
paraphrased, Turkish → English):

> "Everything is actually an independent extra field. The process: a pipe
> gets produced. A work order exists from the start of the project that
> already specifies things like whether it needs coating, whether it needs
> a clutch/additional-part attachment. The pipe is produced, then repaired,
> then — if there's an additional part — it gets assembled, then that part
> gets welded, then if there's nothing else, it goes to coating (if the
> project needs coating; if not, it just waits until it's shipped).
> Sometimes reports come in incomplete or out of order — e.g. a pipe can
> get shipped before its coating report arrives. In situations like that,
> the system should **allow** it, but show a **warning** in the admin
> panel."

So the stage sequence is:

1. **Produced** (cut).
2. **Repaired.**
3. **Additional-part assembly** — only if this project's work order
   requires an additional part (example: a clutch).
4. **Additional-part weld** — the weld step for that same additional part.
5. **Coating** — only if the work order requires it for this project.
   (A pipe shipped *without* its required coating ever happening isn't a
   new category, it's a project card showing `"SHIPPED BARE"` instead of
   `"Coating"` for that pipe — see the screenshot description below — i.e.
   a flag that a required stage was skipped, not a fork in the pipeline.)
6. **Shipped** — the final stage, tracked completely independently of the
   others above.

Two rules, both essential to get right in the schema and the form's
validation behavior:

- **Which stages even apply is a per-project setting**, decided at the
  work order (does *this* project need coating? does it need the
  additional-part step?). The schema needs a per-project configuration of
  which stages are in play — there is no single fixed pipeline every
  project goes through.
- **Out-of-order stage reporting is normal and must be allowed, not
  blocked.** A pipe can be marked Shipped before its Coating report
  arrives. The system should never hard-block this save. It should
  instead **surface a warning** in the admin panel — e.g. "Pipe #14 on
  Project X was marked Shipped, but this project requires Coating and no
  Coating record exists yet." This is conceptually identical to the
  "warn, don't silently corrupt, don't block" principle `dash_app`'s
  order-independent-upsert fix had to implement for dates — generalized
  here to whole lifecycle stages instead of just two date fields.

### Evidence this maps onto real Excel cells

While investigating, several raw Excel cells were found that
`dash_app`'s parser (`project_parser.py`) never reads at all, and that
likely correspond to these same stages rather than being unrelated data —
**this connection is a reasonable hypothesis, not yet confirmed**:

| What was found in the raw cell | Example values | Likely maps to |
|---|---|---|
| A text label near the anchor, not read by the parser | `"Drive Shoe (1)"`, `"Back-Up Ring (1)"`, `"Fused S. Rings (2)"`, `"C. Shoe"` | The additional-part name (stage 3/4)? |
| A text label describing a physical location | `"PIER 1 - PRE STAGE 1 TEMPORARY (TP1-8)"` | A physical stage/location tied to steps 3-5? |
| A short position code | `"E" BOT`, `"D" MID`, `"A" TOP` | Unclear — a position within a rack/stack? |

**Not every block has these** — some project templates show none of them,
only the fields already captured today (pipe #, length, repair amount,
category, surface state). This is consistent with "which stages apply"
being a genuinely per-project setting, not universal fields every pipe
has.

### The screenshot (real project board view)

A screenshot of an actual project summary card was shown directly (not
included as a file here, but describing it precisely since it's important
reference context):

- Title: `"2025Q-10-108JT PROJECT — Ø78" x 0.5" - 15 Pipes"`.
- A grid of pipe tiles, one per pipe: pipe number (large, colored **red**
  if not yet repaired / at `0.00%`, **green** if repaired with a nonzero
  repair rate), a "Repair Rate: X%" label, a colored category band reading
  either `"Coating"` or `"SHIPPED BARE"` (some tiles have neither — just a
  bare number, no band), a length (`"70 feet"` etc.), a length in meters, a
  count, and `"B.E"` (surface state, already captured today).
- Below the grid: `"CUSTOMER : 10"`, `"Carbozinc 11: 3 pcs."` (**a specific
  coating product name and quantity** — not currently captured anywhere;
  whether this is tracked per-pipe or only as this kind of project-level
  rollup is an open question, see section 8), `"Produced: 15"`,
  `"Repaired: 11"`, an overall repair-rate hero number (`"1.89%"`),
  `"PREV. REPAIRED PIPE NO.S: 6"`, `"TOTAL REPAIR AMOUNT (METER): 20.90"`,
  `"DAILY REPAIR AMOUNT (METER): 3.62"`, `"TOTAL REPAIRED B.E. QTY.
  (METER): 4.5"`.

The user also mentioned that pipes shown as **plain numbers with no
colored category band at all** sometimes later get shipped too — i.e.
"Shipped" needs to be trackable independent of whether a pipe ever had a
Coating/Bare category shown for it at all, reinforcing that Shipped is a
fully separate field, not something layered only on top of the
Coating/SHIPPED BARE distinction.

`pipe_repair_details`'s new-system equivalent should be closer to **one row
per pipe with a timestamp (and any stage-specific detail) per lifecycle
stage it actually went through**, plus a per-project config table for
which stages apply to that project. Don't finalize exact field names for
the additional-part stages or the coating-material tracking granularity
without the follow-up conversation flagged in section 8 — write the schema
migration, but leave clear `-- TODO: confirm with user` markers on the
genuinely open pieces rather than guessing silently.

## 6. What the admin data-entry form must prevent

Restating the failure modes from section 1 as concrete requirements:

- **Field-level validation at entry time**, not after the fact — e.g. an
  "incl. skelp" amount can never be saved smaller than the base amount, a
  repair ratio can't exceed 100%, required fields can't be blank. Port the
  logic in `dash_app/validators.py` as the starting checklist, not because
  it's complete, but because it's a verified list of rules that already
  matter.
- **No fixed-size sections anywhere.** Adding a new project is a database
  insert. There is no analog of a 25-row Excel range to silently overflow.
- **No coordinate-based parsing of anything.** A pipe is a real database
  row with a real primary key from the moment it's created in the form —
  never inferred from "whatever text happens to be near this cell."
- **No concept of upload order** — every entry already has a real
  timestamp for when it was actually saved.
- **Out-of-order lifecycle stages are allowed, flagged, not blocked** —
  see section 5.

## 7. Phased roadmap

Full feature parity with `dash_app` is the end goal, but shipping it as one
indivisible release would take months with nothing usable in between.
Build in this order, highest-value piece first:

1. **Repo scaffold (done) + Supabase Auth (done) + Daily Data Entry form
   (core working, done).** The actual point of this whole project.
   - Schema (`supabase/schema.sql`, run on the real Supabase project):
     `project_stage_config` + `pipes`, independent of every `dash_app`
     table, real `id` identity (not an Excel block position).
   - Auth: shared admin login (Supabase Auth email+password), `src/proxy.ts`
     gates `/admin/*`, invite/recovery links land on `/admin/set-password`.
   - `/admin/projects`: per-project stage config (additional part /
     coating on or off).
   - `/admin/pipes`: react-data-grid spreadsheet entry, columns adapt to
     the selected project's stage config, saves through
     `/admin/api/pipes` → `upsertPipe`, which computes `shipped_bare` and
     returns warn-not-block lifecycle warnings inline (never blocks a
     save) — see `computeStageWarnings`/`deriveShippedBare` in
     `src/lib/pipes.ts`.
   - Verified end to end with Playwright against the live dev server and
     the real Supabase project (login → add project → add pipe row →
     save → confirmed the exact row in the database → cleaned up test
     data).
   - Still to do in this phase: numeric/date cell editors with real
     validation instead of free-text (a "Repair Amt" that must be a
     number, a real date picker instead of typing `YYYY-MM-DD`), a
     bulk-paste-from-Excel path (the actual point of using a grid
     library), and revisiting the free-text `additional_part_name` field
     once the still-open Excel-cell-mapping question (section 8) has an
     answer.
   Running alongside `dash_app` for viewing (per section 8, `dash_app`
   freezes at cutover rather than staying live), this phase alone already
   stops new Excel-entry errors from happening once it's the daily driver.
2. **Public Dashboard port** — the charts/tables from `dash_app`'s
   `render_dashboard`, reading whatever the entry form now writes.
3. **Pipe Analysis port** — project trend, the day-colored sequence chart,
   worst-pipes chart, box plots.
4. **Comparison port** — multi-project view.
5. **PDF export port.**
6. **Data Conversion module port** (`dash_app/module2.py`'s cert PDF/Excel
   ingestion) — least connected to the Excel-entry pain point, lowest
   priority.
7. **Retire (or keep as a legacy fallback) `dash_app`'s Import tab** once
   the team is comfortable relying on direct entry — `dash_app` itself
   doesn't have to go away even then; the whole rest of it (Dashboard,
   Pipe Analysis, PDF export, Data Conversion) can keep running as long as
   useful.

Each phase past #1 is really its own future planning session.

## 8. Open decisions

**Resolved (2026-09-10):**

- **Admin accounts: one shared login**, not per-person. Simpler to set up;
  no per-user audit trail (accepted trade-off — the out-of-order-stage
  warning from section 5 still works, it just won't say *who* triggered it).
- **Coating: a simple done/not-done flag**, not per-pipe material tracking.
  Some pipes get multiple coating layers with different products — that
  level of detail is real but deliberately deferred; `pipes.coating_done`
  (boolean) is all the new schema captures for now. Can be extended later
  without a breaking migration (`supabase/schema.sql` already isolates
  coating into its own two columns for exactly this reason).
- **`dash_app`'s data feed: single-write, `pipes` only.** Once the new
  admin panel is the live data-entry point, it does **not** dual-write into
  `dash_app`'s `pipe_repair_details` — `dash_app` freezes at whatever data
  exists at cutover rather than staying live. In effect this decides
  `dash_app`'s fate as "kept only as a frozen historical fallback," even
  though the *general* "when do we retire dash_app" question above was
  left open — the two answers are slightly in tension and worth being
  aware of, but this is the more concrete, load-bearing one: it fixes the
  entry form's save path as single-write (`pipes` table only), no
  dash_app-shape writes anywhere in Phase 1.
- Schema implemented in `supabase/schema.sql` — two new tables
  (`project_stage_config`, `pipes`), independent of every `dash_app` table,
  identity is a real `id` (not an Excel block position). Run once in the
  Supabase SQL Editor, same project `dash_app` uses.

**Still open — do not guess, ask the user directly:**

- Exact field names for the additional-part assembly + weld stages, and
  whether the raw Excel cells in the table in section 5 actually map onto
  these stages the way hypothesized, or are genuinely separate data. Low
  urgency: the new entry form doesn't need to parse Excel cells at all
  (that only matters for the phase-6 historical-import module), so
  `pipes.additional_part_name` is free text for now and can absorb
  whatever the real answer turns out to be.

## 9. Reference material in this repo

`reference-excel/` contains real (anonymization not needed — this is
internal operational data, not customer/personal data) daily report files
copied from `dash_app/exam files/`, for grounding the pipe lifecycle
model and the general sheet structure in actual data rather than only this
document's description of it. Useful for understanding what a "project
sheet" and its pipe blocks actually look like before any of it existed as
database rows.

## 10. Verification approach

Each phase gets verified against the same live Supabase data `dash_app`
already uses — e.g. Phase 1's entry form should be checked by entering a
known real day's data and confirming the resulting `pipe_repair_details`
rows match what the equivalent `dash_app` Excel-upload path would have
produced for the same day (there's real historical data in
`reference-excel/` and in the live database to check against). Later
phases get verified by comparing rendered charts/numbers directly against
`dash_app`'s own current output for the same date, side by side, until
parity is confirmed.
