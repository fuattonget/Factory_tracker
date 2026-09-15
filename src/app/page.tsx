import Link from "next/link";
import { SummaryCard } from "@/components/SummaryCard";
import { NewestPipesTable } from "@/components/NewestPipesTable";
import {
  RepairRateTrendChart,
  DailyRepairAmountChart,
  ProductionTypeTrendChart,
  RepairAmountParetoChart,
  RepairRatioParetoChart,
  BacklogTrendChart,
} from "./DashboardCharts";
import {
  loadMasterData,
  dailyWeightedRepairRatios,
  repairAmountTrendData,
  productionTypeTrendSeries,
  summarize,
  getLatestDayRows,
  repairAmountPareto,
  repairRatioPareto,
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
  const amounts = repairAmountTrendData(rows);
  const typeTrend = productionTypeTrendSeries(rows);
  const summary = summarize(rows, ratios);
  const pipeOverview = buildPipeOverview(pipes, links);
  const backlogTrend = buildBacklogTrend(pipes, links);
  const latestDayRows = getLatestDayRows(rows);
  const amountPareto = repairAmountPareto(latestDayRows);
  const ratioPareto = repairRatioPareto(latestDayRows);

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
          <RepairRateTrendChart data={ratios} />
          <ProductionTypeTrendChart series={typeTrend} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {backlogTrend && <BacklogTrendChart data={backlogTrend} />}
          <DailyRepairAmountChart data={amounts} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RepairAmountParetoChart data={amountPareto} />
          <RepairRatioParetoChart data={ratioPareto} />
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
