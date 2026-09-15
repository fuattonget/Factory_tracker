import Link from "next/link";
import { SummaryCard } from "@/components/SummaryCard";
import { NewestPipesTable } from "@/components/NewestPipesTable";
import { BacklogDetailTable } from "@/components/BacklogDetailTable";
import {
  RepairRateTrendChart,
  DailyRepairAmountChart,
  ProductionTypeTrendChart,
  RepairAmountParetoChart,
  RepairRatioParetoChart,
  BacklogTrendChart,
  WorstProjectsChart,
  SkelpImpactRatioChart,
  SkelpImpactAmountChart,
} from "./DashboardCharts";
import {
  loadMasterData,
  dailyWeightedRepairRatios,
  dailyWeightedRepairRatiosInclSkelp,
  repairAmountTrendData,
  productionTypeTrendSeries,
  summarize,
  getLatestDayRows,
  repairAmountPareto,
  repairRatioPareto,
  worstProjectsByRatio,
  skelpImpactByRatio,
  skelpImpactByAmount,
} from "@/lib/dashboard";
import { loadPipeRepairDetails, loadProjectSheetLinks, buildPipeOverview, buildBacklogTrend } from "@/lib/pipeOverview";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function Dashboard() {
  const [rows, pipes, links] = await Promise.all([
    loadMasterData(),
    loadPipeRepairDetails(),
    loadProjectSheetLinks(),
  ]);

  if (rows.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Factory Tracker</h1>
            <Link href="/board" className="text-sm font-medium text-blue-600 hover:underline">
              Project Board
            </Link>
          </div>
          <p className="mt-4 text-slate-500">No data yet.</p>
        </div>
      </main>
    );
  }

  const ratios = dailyWeightedRepairRatios(rows);
  const ratiosInclSkelp = dailyWeightedRepairRatiosInclSkelp(rows);
  const amounts = repairAmountTrendData(rows);
  const typeTrend = productionTypeTrendSeries(rows);
  const summary = summarize(rows, ratios);
  const pipeOverview = buildPipeOverview(pipes, links);
  const backlogTrend = buildBacklogTrend(pipes, links);
  const latestDayRows = getLatestDayRows(rows);
  const amountPareto = repairAmountPareto(latestDayRows);
  const ratioPareto = repairRatioPareto(latestDayRows);
  const worstProjects = worstProjectsByRatio(latestDayRows);
  const skelpRatio = skelpImpactByRatio(latestDayRows);
  const skelpAmount = skelpImpactByAmount(latestDayRows);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Factory Tracker</h1>
            <p className="mt-1 text-sm text-slate-500">Overview / Dashboard</p>
          </div>
          <Link href="/board" className="text-sm font-medium text-blue-600 hover:underline">
            Project Board
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <SummaryCard
            label="Last Report Date"
            value={summary.lastReportDate ? formatDate(summary.lastReportDate) : "-"}
          />
          <SummaryCard label="Active Project Count" value={String(summary.activeProjectCount)} />
          <SummaryCard
            label="Coil and Plate Repair Rate"
            value={`${(summary.currentOverallRatio * 100).toFixed(2)}%`}
            accent
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RepairRateTrendChart dataExcl={ratios} dataIncl={ratiosInclSkelp} />
          <ProductionTypeTrendChart series={typeTrend} />
        </div>

        <div className="mt-5">
          <WorstProjectsChart data={worstProjects} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SkelpImpactRatioChart data={skelpRatio} />
          <SkelpImpactAmountChart data={skelpAmount} />
        </div>

        <div className="mt-5">
          <RepairRatioParetoChart data={ratioPareto} />
        </div>
        <div className="mt-5">
          <RepairAmountParetoChart data={amountPareto} />
        </div>

        {backlogTrend && (
          <div className="mt-5">
            <BacklogTrendChart data={backlogTrend} />
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DailyRepairAmountChart data={amounts} />
          {backlogTrend && <BacklogDetailTable data={backlogTrend} />}
        </div>

        {(pipeOverview.newestProduced || pipeOverview.newestRepaired) && (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {pipeOverview.newestProduced && (
              <NewestPipesTable
                title="Newest Produced Pipes"
                date={pipeOverview.newestProduced.date}
                rows={pipeOverview.newestProduced.rows}
              />
            )}
            {pipeOverview.newestRepaired && (
              <NewestPipesTable
                title="Newest Repaired Pipes"
                date={pipeOverview.newestRepaired.date}
                rows={pipeOverview.newestRepaired.rows}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
