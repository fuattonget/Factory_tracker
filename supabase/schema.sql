-- Factory Tracker (Next.js) — new lifecycle tables.
-- Run this once in Supabase Dashboard > SQL Editor (same project dash_app
-- uses — data is reused, not migrated). This file only ADDS new tables; it
-- never touches repair_rates / pipe_repair_details / project_sheet_links /
-- project_group_configs, so dash_app is unaffected either way. See
-- ../PROJECT_PLAN.md section 5 for the full lifecycle model this encodes.
--
-- Real pipe lifecycle (clarified directly by the user):
--   Produced -> Repaired -> [if required] Additional-part Assembly ->
--   Additional-part Weld -> [if required] Coating -> Shipped
-- Which stages apply is a per-project setting (project_stage_config).
-- A later stage can be recorded before an earlier required one — the app
-- layer warns about it, it never blocks the save.

create table if not exists project_stage_config (
    project_no text primary key,
    -- A project's pipes are normally all one spec -- diameter ("çap") and
    -- wall thickness ("kalınlık") in inches, matching dash_app's own
    -- Ø{diameter}"x{wall_thickness}" dimensions format. Used to auto-fill
    -- each new pipe row so it doesn't need retyping per pipe.
    diameter numeric,
    wall_thickness numeric,
    -- Raw coil/skelp strip width ("W" in dash_app's Excel formula, e.g.
    -- K4 = (diameter*PI/W)*length -- see computeSpiralLengthM in
    -- src/lib/pipes.ts), inches. One value per project row: a real-world
    -- project needing a different band width is treated as a *separate*
    -- project_stage_config row (its own project_no), same as dash_app's
    -- own sheet-name variants like "10-108 (84xx)" vs "10-108 (90xx)" --
    -- confirmed directly by the user, not a per-pipe or per-group field.
    band_width numeric,
    -- Matches dash_app's own project categorization (used by the public
    -- Dashboard's "Repair Rate Trend by Production Type" chart).
    production_type text check (production_type in ('Coil', 'Plate')),
    project_status text check (project_status in ('In Progress', 'Completed', 'On Hold')),
    customer_name text,
    -- Soft delete only -- project_no is immutable (no rename UI exists).
    -- Archived projects are hidden from the daily-entry project picker by
    -- default but never hard-deleted; see listProjectStageConfigs in
    -- src/lib/pipes.ts.
    archived boolean not null default false,
    requires_additional_part boolean not null default false,
    requires_coating boolean not null default false,
    notes text,
    updated_at timestamptz not null default now()
);

-- Planned sub-groups within a project's total pipe count -- e.g. "Grup 1:
-- 10 pipes, 55ft, has Clutch" + "Grup 2: 50 pipes, 50ft, no Clutch" in the
-- SAME project (dimension/band_width stay fixed at the project level, see
-- project_stage_config above -- confirmed directly by the user). This is
-- planning/target data set up once at project-setup time, distinct from
-- the actual pipes rows produced later day by day. The Borular entry
-- grid's "Gruptan ekle" bulk-add reads these to pre-fill quantity/length/
-- features in one click.
create table if not exists project_pipe_groups (
    id bigint generated always as identity primary key,
    project_no text not null references project_stage_config(project_no) on delete cascade,
    label text,
    planned_qty integer not null check (planned_qty > 0),
    pipe_length_ft numeric,
    -- Same preset+custom picker as pipes.features -- see
    -- src/lib/pipeFeatures.ts and src/components/FeaturesPicker.tsx.
    features text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists pipes (
    id bigint generated always as identity primary key,
    project_no text not null references project_stage_config(project_no),
    pipe_no integer not null,
    dimensions text,
    pipe_length_ft numeric,

    -- Stage 1: Produced
    produced_date date not null,

    -- Stage 2: Repaired
    repair_amount numeric,
    -- "Total Repair Amount incl. Skelp-end Welds (B.E.)" in the real
    -- sheets -- the original "M35 bug" (PROJECT_PLAN.md section 1) was
    -- this value once saved smaller than repair_amount; validatePipeInput
    -- in src/lib/pipes.ts now makes that structurally impossible.
    repair_amount_incl_skelp numeric,
    -- Both ratios are SERVER-COMPUTED ONLY (computeRepairRatio in
    -- src/lib/pipes.ts) -- never accepted from the client. PipeInput
    -- (src/lib/types.ts) omits both; upsertPipe fills them in before the
    -- insert/update, from repair_amount(_incl_skelp) and this project's
    -- diameter/band_width.
    repair_ratio numeric,
    repair_ratio_incl_skelp numeric,
    repair_count integer,
    repair_category text,
    surface_state text,
    repaired_date date,
    status text not null default 'Produced' check (status in ('Produced', 'Repaired')),

    -- Stages 3/4: additional part — only meaningful when this project's
    -- project_stage_config.requires_additional_part is true. Free-text name
    -- since the part varies per work order (e.g. a clutch); exact field
    -- naming can be refined later without a breaking migration.
    additional_part_name text,
    additional_part_qty integer,
    additional_part_assembled_date date,
    additional_part_welded_date date,

    -- Stage 5: coating — only meaningful when requires_coating is true.
    -- Kept as a simple done/not-done flag for now (per-pipe coating
    -- material detail, e.g. "Carbozinc 11", deliberately deferred — see
    -- PROJECT_PLAN.md open decisions).
    coating_done boolean not null default false,
    coating_date date,

    -- Stage 6: shipped — tracked independently of every stage above.
    -- shipped_bare flags a normally-coated pipe that shipped without ever
    -- getting its required coating step (mirrors the real board view's
    -- "SHIPPED BARE" label).
    shipped_date date,
    shipped_bare boolean not null default false,

    -- General-purpose tags, independent of the lifecycle-stage fields
    -- above (those drive the warn-not-block logic; these are just
    -- informational). Preset options confirmed against the real Excel
    -- (06-131 sheet): Clutch, Drive Shoe, Back-Up Ring, Fused S. Rings,
    -- Coating -- plus a free-text custom entry for anything else. See
    -- src/lib/pipeFeatures.ts.
    features text[] not null default '{}',

    -- Nullable: set only when this pipe was bulk-added from a predefined
    -- project_pipe_groups row (for "8 of 10 from Group 1 produced so far"
    -- progress tracking, see listProjectPipeGroupsWithProgress in
    -- src/lib/pipes.ts); null for ad-hoc rows. ON DELETE SET NULL so
    -- deleting a group definition never deletes/orphans real pipe records.
    group_id bigint references project_pipe_groups(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_no, pipe_no)
);

-- RLS stays enabled by default, same model as dash_app: the Next.js server
-- (Server Components / Route Handlers / Server Actions) connects with the
-- service_role key, which bypasses RLS automatically — no client ever
-- queries these tables directly, so no extra policies are needed. The
-- anon/public key is used only for Supabase Auth (admin login), never for
-- data queries. See PROJECT_PLAN.md section 3.
alter table project_stage_config enable row level security;
alter table project_pipe_groups enable row level security;
alter table pipes enable row level security;

-- ---------------------------------------------------------------------------
-- MIGRATION for the already-live tables above (the `create table if not
-- exists` statements only apply to a brand-new project). Run this block
-- once, by hand, in the SQL Editor -- safe to run more than once (every
-- statement is idempotent).
-- ---------------------------------------------------------------------------
-- alter table project_stage_config add column if not exists diameter numeric;
-- alter table project_stage_config add column if not exists wall_thickness numeric;
-- alter table pipes add column if not exists features text[] not null default '{}';
-- alter table project_stage_config add column if not exists band_width numeric;
-- alter table project_stage_config add column if not exists production_type text check (production_type in ('Coil', 'Plate'));
-- alter table project_stage_config add column if not exists project_status text check (project_status in ('In Progress', 'Completed', 'On Hold'));
-- alter table project_stage_config add column if not exists customer_name text;
-- alter table project_stage_config add column if not exists archived boolean not null default false;
-- alter table pipes add column if not exists repair_amount_incl_skelp numeric;
-- alter table pipes add column if not exists repair_ratio_incl_skelp numeric;
-- (project_pipe_groups is a brand-new table -- the uncommented
-- `create table if not exists project_pipe_groups` above already handles
-- creating it on the live DB too. Run that BEFORE the line below, since
-- this FK needs the table to exist first.)
-- alter table pipes add column if not exists group_id bigint references project_pipe_groups(id) on delete set null;
