"use client";

import Plot from "@/components/Plot";
import type { DailyAmountPoint, DailyRatioPoint } from "@/lib/dashboard";

const PRIMARY = "#2563eb"; // matches dash_app's --color-primary, single-series charts need no legend/second hue
const AXIS_TEXT = "#64748b";
const GRID_LINE = "#f1f5f9";
const BORDER_LINE = "#e2e8f0";

const baseFont = { family: "system-ui, sans-serif", color: "#1e293b" };

const baseLayout = {
  autosize: true,
  margin: { l: 56, r: 16, t: 8, b: 44 },
  plot_bgcolor: "white",
  paper_bgcolor: "white",
  font: baseFont,
  hoverlabel: { bgcolor: "white", bordercolor: BORDER_LINE, font: { color: "#1e293b", size: 12 } },
  xaxis: {
    showgrid: false,
    tickformat: "%d.%m.%y",
    tickangle: -45,
    tickfont: { size: 11, color: AXIS_TEXT },
    linecolor: BORDER_LINE,
    ticks: "outside" as const,
    tickcolor: BORDER_LINE,
  },
};

const config = { displayModeBar: false, responsive: true };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

export function RepairRateTrendChart({ data }: { data: DailyRatioPoint[] }) {
  return (
    <ChartCard title="Overall Repair Rate Trend">
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            x: data.map((d) => d.date),
            y: data.map((d) => d.weighted_repair_ratio),
            line: { color: PRIMARY, width: 2, shape: "spline" },
            marker: { size: 6, color: PRIMARY },
            hovertemplate: "%{x|%d.%m.%Y}<br>Repair Rate: <b>%{y:.2%}</b><extra></extra>",
          },
        ]}
        layout={{
          ...baseLayout,
          yaxis: {
            showgrid: true,
            gridcolor: GRID_LINE,
            zeroline: false,
            tickformat: ".1%",
            tickfont: { size: 11, color: AXIS_TEXT },
          },
        }}
        config={config}
        style={{ width: "100%", height: "320px" }}
        useResizeHandler
      />
    </ChartCard>
  );
}

export function DailyRepairAmountChart({ data }: { data: DailyAmountPoint[] }) {
  return (
    <ChartCard title="Daily Repair Amount (ft)">
      <Plot
        data={[
          {
            type: "bar",
            x: data.map((d) => d.date),
            y: data.map((d) => d.daily_repair_amount),
            marker: { color: PRIMARY },
            hovertemplate: "%{x|%d.%m.%Y}<br>Daily Repair Amount: <b>%{y:.2f} ft</b><extra></extra>",
          },
        ]}
        layout={{
          ...baseLayout,
          yaxis: {
            showgrid: true,
            gridcolor: GRID_LINE,
            zeroline: false,
            tickfont: { size: 11, color: AXIS_TEXT },
          },
        }}
        config={config}
        style={{ width: "100%", height: "320px" }}
        useResizeHandler
      />
    </ChartCard>
  );
}
