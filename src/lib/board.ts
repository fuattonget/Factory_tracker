import type { Pipe, ProjectStageConfig } from "@/lib/types";
import { computeSpiralLengthM, computeRepairRatio, formatDimensions } from "@/lib/pipes";
import { METERS_PER_FOOT } from "@/lib/units";

// The public-facing per-project tile board (PROJECT_PLAN.md section 5's
// "screenshot" description: a grid of pipe tiles, colored by repair
// status, with a category band and a project-level stats footer) --
// reads the new pipes/project_stage_config tables directly (the tables
// the admin panel actually writes), unlike the rest of the public
// Dashboard (src/lib/dashboard.ts), which still reads dash_app's legacy
// repair_rates/pipe_repair_details tables. Pure view-model functions,
// no data fetching here -- see listProjectStageConfigs/listPipes in
// lib/pipes.ts for that.

export type TileBand = "Coating" | "Shipped Bare" | null;

export interface PipeTile {
  pipe_no: number;
  repaired: boolean;
  repair_ratio: number | null;
  pipe_length_ft: number | null;
  pipe_length_m: number | null;
  band: TileBand;
  shipped: boolean;
  features: string[];
}

export function buildPipeTile(
  pipe: Pipe,
  config: Pick<ProjectStageConfig, "requires_coating">
): PipeTile {
  let band: TileBand = null;
  if (pipe.shipped_bare) band = "Shipped Bare";
  else if (config.requires_coating && pipe.coating_done) band = "Coating";

  return {
    pipe_no: pipe.pipe_no,
    repaired: pipe.repair_amount != null,
    repair_ratio: pipe.repair_ratio,
    pipe_length_ft: pipe.pipe_length_ft,
    pipe_length_m: pipe.pipe_length_ft != null ? pipe.pipe_length_ft * METERS_PER_FOOT : null,
    band,
    shipped: pipe.shipped_date != null,
    features: pipe.features,
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
  tiles: PipeTile[];
  stats: ProjectBoardStats;
}

// Same "sum of amounts over sum of spiral lengths" methodology as the
// public Dashboard's dailyWeightedRepairRatios (src/lib/dashboard.ts) and
// PipeGrid.tsx's summaryStats, just built from the new pipes table's
// already-stored per-pipe values instead of recomputed live.
export function buildProjectBoard(config: ProjectStageConfig, pipes: Pipe[]): ProjectBoard {
  const tiles = pipes
    .map((p) => buildPipeTile(p, config))
    .sort((a, b) => a.pipe_no - b.pipe_no);

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
    tiles,
    stats: {
      producedCount: pipes.length,
      repairedCount,
      shippedCount,
      totalRepairAmountM: totalRepairM,
      overallRatio: computeRepairRatio(totalRepairM || null, totalSpiralM || null),
    },
  };
}
