import { SummaryCard } from "@/components/SummaryCard";
import { RepairRateTrendChart, DailyRepairAmountChart } from "./DashboardCharts";
import {
  loadMasterData,
  dailyWeightedRepairRatios,
  repairAmountTrendData,
  summarize,
} from "@/lib/dashboard";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default async function Dashboard() {
  const rows = await loadMasterData();

  if (rows.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-slate-900">Factory Tracker</h1>
          <p className="mt-4 text-slate-500">Henüz veri yok.</p>
        </div>
      </main>
    );
  }

  const ratios = dailyWeightedRepairRatios(rows);
  const amounts = repairAmountTrendData(rows);
  const summary = summarize(rows, ratios);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900">Factory Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Genel Bakış / Dashboard</p>

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
          <DailyRepairAmountChart data={amounts} />
        </div>
      </div>
    </main>
  );
}
