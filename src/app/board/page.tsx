import Link from "next/link";
import {
  listProjectStageConfigs,
  listPipes,
  listProjectPipeGroups,
  listPipePartProgressForProject,
} from "@/lib/pipes";
import { buildProjectBoard } from "@/lib/board";
import { PipeTileCard } from "@/components/PipeTileCard";

// Pipes change throughout the day as the admin panel is used -- without
// this, Next would statically bake the board at build time (no cookies/
// headers here to otherwise force dynamic rendering) and it'd only show
// whatever was true at the last deploy.
export const dynamic = "force-dynamic";

// Public, no-auth project board -- PROJECT_PLAN.md section 5's
// "screenshot" description (a grid of colored pipe tiles per project),
// reading the new pipes/project_stage_config tables directly (what the
// admin panel actually writes), unlike the rest of the public Dashboard
// (src/app/page.tsx), which still reads dash_app's legacy tables. See
// src/lib/board.ts for the view-model.
export default async function BoardPage() {
  const configs = await listProjectStageConfigs();
  const boards = await Promise.all(
    configs.map(async (config) => {
      const [pipes, groups, partProgress] = await Promise.all([
        listPipes(config.project_no),
        listProjectPipeGroups(config.project_no),
        config.requires_additional_part
          ? listPipePartProgressForProject(config.project_no)
          : Promise.resolve([]),
      ]);
      return buildProjectBoard(config, pipes, groups, partProgress);
    })
  );
  const nonEmptyBoards = boards.filter((b) => b.tiles.length > 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Factory Tracker</h1>
            <p className="mt-1 text-sm text-slate-500">Project Board</p>
          </div>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Dashboard
          </Link>
        </div>

        {nonEmptyBoards.length === 0 ? (
          <p className="mt-6 text-slate-500">No pipes entered yet.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {nonEmptyBoards.map((board) => (
              <section key={board.project.project_no} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    {board.project.project_no} PROJECT
                    {board.dimensionsLabel && (
                      <span className="font-normal text-slate-500"> — {board.dimensionsLabel}</span>
                    )}
                    <span className="font-normal text-slate-500"> — {board.stats.producedCount} Pipes</span>
                  </h2>
                  {board.project.project_status && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {board.project.project_status}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                  {board.tiles.map((tile, i) => (
                    <PipeTileCard key={tile.kind === "pipe" ? `pipe-${tile.pipe_no}` : `planned-${i}`} tile={tile} />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  {board.project.customer_name && (
                    <span>
                      <span className="text-slate-400">Customer:</span> {board.project.customer_name}
                    </span>
                  )}
                  <span>
                    <span className="text-slate-400">Produced:</span> {board.stats.producedCount}
                  </span>
                  <span>
                    <span className="text-slate-400">Repaired:</span> {board.stats.repairedCount}
                  </span>
                  <span>
                    <span className="text-slate-400">Shipped:</span> {board.stats.shippedCount}
                  </span>
                  <span>
                    <span className="text-slate-400">Total Repair Amount (m):</span>{" "}
                    {board.stats.totalRepairAmountM.toFixed(2)}
                  </span>
                  <span className="font-semibold text-blue-600">
                    Overall Repair Rate:{" "}
                    {board.stats.overallRatio != null ? `${(board.stats.overallRatio * 100).toFixed(2)}%` : "—"}
                  </span>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
