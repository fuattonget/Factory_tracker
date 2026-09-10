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
    requires_additional_part boolean not null default false,
    requires_coating boolean not null default false,
    notes text,
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
    repair_ratio numeric,
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
alter table pipes enable row level security;
