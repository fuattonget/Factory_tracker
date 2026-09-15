import type { Pipe, PipePartProgress, ProjectPipeGroup, ProjectStageConfig } from "@/lib/types";
import { computeSpiralLengthM, computeRepairRatio, formatDimensions } from "@/lib/pipes";
import { METERS_PER_FOOT } from "@/lib/units";
import { colorForGroupIndex, NO_GROUP_COLOR } from "@/lib/palette";

// The public-facing per-project tile board (PROJECT_PLAN.md section 5's
// "screenshot" description: a grid of pipe tiles, colored by repair
// status, with a category band and a project-level stats footer) --
// reads the new pipes/project_stage_config tables directly (the tables
// the admin panel actually writes), unlike the rest of the public
// Dashboard (src/lib/dashboard.ts), which still reads dash_app's legacy
// repair_rates/pipe_repair_details tables. Pure view-model functions,
// no data fetching here -- see listProjectStageConfigs/listPipes in
// lib/pipes.ts for that.
//
// Two independent color channels per tile, confirmed directly by the
// user from real Excel examples: a CATEGORICAL color per planned group
// (groupColor -- which batch this pipe belongs to, shown on the tile's
// header/border) and a STATUS color per feature (done/in-progress/not
// started -- see FeatureState), since a project real example showed two
// features on the same pipe at different states simultaneously (Clutch
// mid-assembly, Back-Up Ring already welded). See src/lib/palette.ts for
// the actual color values -- both channels are the dataviz skill's
// validated palette, never eyeballed.

export type TileBand = "Coating" | "Shipped Bare" | null;

export type FeatureState = "done" | "in_progress" | "pending";

export interface FeatureTag {
  feature: string;
  state: FeatureState;
}

export interface PipeTile {
  kind: "pipe";
  pipe_no: number;
  repaired: boolean;
  repair_ratio: number | null;
  // "0.00 m." / "B.E" row on the real tile -- the B.E. (incl.-skelp) total,
  // see pipes.repair_amount_incl_skelp.
  repair_amount_incl_skelp_m: number | null;
  pipe_length_ft: number | null;
  pipe_length_m: number | null;
  band: TileBand;
  shipped: boolean;
  features: FeatureTag[];
  groupLabel: string | null;
  groupColor: string;
}

// A pipe that's still only planned, not yet produced (see
// project_pipe_groups.planned_qty vs. how many real pipes rows are
// tagged with that group so far) -- rendered as a mostly-empty slot
// (real example: length + which features apply, no number, no
// repair-rate/B.E. values) confirmed directly by the user, so the board
// shows the *whole* expected project, not just what's been produced.
export interface PlannedTile {
  kind: "planned";
  pipe_length_ft: number | null;
  pipe_length_m: number | null;
  features: FeatureTag[];
  groupLabel: string | null;
  groupColor: string;
}

export type BoardTile = PipeTile | PlannedTile;

// Which state to color a pipe's feature band cells with -- "pending"
// (nothing started yet) falls back to the group color rather than a
// status color, so an untouched feature reads as identity, not alarm.
// When the project doesn't track_parts_separately, every feature on the
// pipe shares the one Assembled/Welded pair; when it does, each feature
// looks up its own row in pipe_part_progress.
function featureStateFor(
  pipe: Pipe,
  feature: string,
  config: Pick<ProjectStageConfig, "requires_additional_part" | "track_parts_separately">,
  progressByPipeFeature: Map<string, PipePartProgress>
): FeatureState {
  if (!config.requires_additional_part) return "pending";
  if (config.track_parts_separately) {
    const progress = progressByPipeFeature.get(`${pipe.id}::${feature}`);
    if (progress?.welded_date) return "done";
    if (progress?.assembled_date) return "in_progress";
    return "pending";
  }
  if (pipe.additional_part_welded_date) return "done";
  if (pipe.additional_part_assembled_date) return "in_progress";
  return "pending";
}

function buildPipeTile(
  pipe: Pipe,
  config: Pick<ProjectStageConfig, "requires_coating" | "requires_additional_part" | "track_parts_separately">,
  groupLabel: string | null,
  groupColor: string,
  progressByPipeFeature: Map<string, PipePartProgress>
): PipeTile {
  let band: TileBand = null;
  if (pipe.shipped_bare) band = "Shipped Bare";
  else if (config.requires_coating && pipe.coating_done) band = "Coating";

  return {
    kind: "pipe",
    pipe_no: pipe.pipe_no,
    repaired: pipe.repair_amount != null,
    repair_ratio: pipe.repair_ratio,
    repair_amount_incl_skelp_m: pipe.repair_amount_incl_skelp,
    pipe_length_ft: pipe.pipe_length_ft,
    pipe_length_m: pipe.pipe_length_ft != null ? pipe.pipe_length_ft * METERS_PER_FOOT : null,
    band,
    shipped: pipe.shipped_date != null,
    features: pipe.features.map((feature) => ({
      feature,
      state: featureStateFor(pipe, feature, config, progressByPipeFeature),
    })),
    groupLabel,
    groupColor,
  };
}

export interface ProjectBoardStats {
  producedCount: number;
  repairedCount: number;
  shippedCount: number;
  totalRepairAmountM: number;
  overallRatio: number | null;
}

export interface ProjectBoard {
  project: ProjectStageConfig;
  dimensionsLabel: string | null;
  tiles: BoardTile[];
  stats: ProjectBoardStats;
}

// Same "sum of amounts over sum of spiral lengths" methodology as the
// public Dashboard's dailyWeightedRepairRatios (src/lib/dashboard.ts) and
// PipeGrid.tsx's summaryStats, just built from the new pipes table's
// already-stored per-pipe values instead of recomputed live.
export function buildProjectBoard(
  config: ProjectStageConfig,
  pipes: Pipe[],
  groups: ProjectPipeGroup[],
  partProgress: PipePartProgress[] = []
): ProjectBoard {
  // One categorical color per group, assigned in creation order (id
  // ascending, i.e. the order groups were defined in) -- identity, not
  // magnitude, so a fixed assignment rather than anything data-derived.
  const groupColorById = new Map<number, string>();
  groups.forEach((g, i) => groupColorById.set(g.id, colorForGroupIndex(i)));
  const groupLabelById = new Map<number, string>(groups.map((g) => [g.id, g.label ?? `Group ${g.id}`]));
  const progressByPipeFeature = new Map<string, PipePartProgress>(
    partProgress.map((p) => [`${p.pipe_id}::${p.feature}`, p])
  );

  const producedCountByGroup = new Map<number, number>();
  for (const p of pipes) {
    if (p.group_id != null) {
      producedCountByGroup.set(p.group_id, (producedCountByGroup.get(p.group_id) ?? 0) + 1);
    }
  }

  const pipeTiles: BoardTile[] = pipes
    .map((p) =>
      buildPipeTile(
        p,
        config,
        p.group_id != null ? (groupLabelById.get(p.group_id) ?? null) : null,
        p.group_id != null ? (groupColorById.get(p.group_id) ?? NO_GROUP_COLOR) : NO_GROUP_COLOR,
        progressByPipeFeature
      )
    )
    .sort((a, b) => (a as PipeTile).pipe_no - (b as PipeTile).pipe_no);

  const plannedTiles: PlannedTile[] = groups.flatMap((g, i) => {
    const remaining = Math.max(0, g.planned_qty - (producedCountByGroup.get(g.id) ?? 0));
    return Array.from({ length: remaining }, () => ({
      kind: "planned" as const,
      pipe_length_ft: g.pipe_length_ft,
      pipe_length_m: g.pipe_length_ft != null ? g.pipe_length_ft * METERS_PER_FOOT : null,
      features: g.features.map((feature) => ({ feature, state: "pending" as const })),
      groupLabel: g.label ?? `Group ${g.id}`,
      groupColor: colorForGroupIndex(i),
    }));
  });

  let totalRepairM = 0;
  let totalSpiralM = 0;
  let repairedCount = 0;
  let shippedCount = 0;
  for (const p of pipes) {
    if (p.repair_amount != null) {
      repairedCount += 1;
      const spiral = computeSpiralLengthM(config, p.pipe_length_ft);
      if (spiral != null) {
        totalRepairM += p.repair_amount;
        totalSpiralM += spiral;
      }
    }
    if (p.shipped_date != null) shippedCount += 1;
  }

  return {
    project: config,
    dimensionsLabel: formatDimensions(config.diameter, config.wall_thickness),
    tiles: [...pipeTiles, ...plannedTiles],
    stats: {
      producedCount: pipes.length,
      repairedCount,
      shippedCount,
      totalRepairAmountM: totalRepairM,
      overallRatio: computeRepairRatio(totalRepairM || null, totalSpiralM || null),
    },
  };
}
