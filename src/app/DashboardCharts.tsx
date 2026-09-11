"use client";

import { useState } from "react";
import Plot from "@/components/Plot";
import type { DailyAmountPoint, DailyRatioPoint, ProductionTypeTrendSeries, ParetoPoint } from "@/lib/dashboard";

const PRIMARY = "#2563eb"; // matches dash_app's --color-primary, single-series charts need no legend/second hue
const AXIS_TEXT = "#64748b";
const GRID_LINE = "#f1f5f9";
const BORDER_LINE = "#e2e8f0";

// Same fixed categorical assignment dash_app already ships -- reused
// as-is for parity rather than re-derived, per the dataviz skill's own
// "onboard an existing system's parameters" allowance.
const COLOR_COIL = "#2563eb";
const COLOR_PLATE = "#7c3aed";
const COLOR_MIX = "#f97316";

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

type ProductionType = "Coil" | "Plate" | "Mix";
const TYPE_OPTIONS: { value: ProductionType; label: string; color: string }[] = [
  { value: "Coil", label: "Coil", color: COLOR_COIL },
  { value: "Plate", label: "Plate", color: COLOR_PLATE },
  { value: "Mix", label: "Mix (Coil + Plate)", color: COLOR_MIX },
];

export function ProductionTypeTrendChart({ series }: { series: ProductionTypeTrendSeries }) {
  const [selected, setSelected] = useState<Set<ProductionType>>(
    new Set(["Coil", "Plate", "Mix"])
  );

  function toggle(type: ProductionType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Only the last point of each series gets a text label (a "current
  // value" callout) -- labeling every point (dash_app's original behavior)
  // overlaps badly once >10 points share this width. See dataviz skill:
  // "selective direct labels, never a number on every point."
  function lastPointOnly(points: DailyRatioPoint[]): string[] {
    return points.map((d, i) =>
      i === points.length - 1 ? `${(d.weighted_repair_ratio * 100).toFixed(2)}%` : ""
    );
  }

  const traces = [];
  if (selected.has("Coil")) {
    traces.push({
      type: "scatter" as const,
      mode: "lines+markers+text" as const,
      name: "Coil",
      x: series.coil.map((d) => d.date),
      y: series.coil.map((d) => d.weighted_repair_ratio * 100),
      text: lastPointOnly(series.coil),
      textposition: "top center" as const,
      textfont: { size: 11, color: COLOR_COIL },
      line: { width: 2, color: COLOR_COIL },
      marker: { size: 6, color: COLOR_COIL },
      hovertemplate: "%{x|%d.%m.%Y}<br>Coil: <b>%{y:.2f}%</b><extra></extra>",
    });
  }
  if (selected.has("Plate")) {
    traces.push({
      type: "scatter" as const,
      mode: "lines+markers+text" as const,
      name: "Plate",
      x: series.plate.map((d) => d.date),
      y: series.plate.map((d) => d.weighted_repair_ratio * 100),
      text: lastPointOnly(series.plate),
      textposition: "top center" as const,
      textfont: { size: 11, color: COLOR_PLATE },
      line: { width: 2, color: COLOR_PLATE },
      marker: { size: 6, color: COLOR_PLATE },
      hovertemplate: "%{x|%d.%m.%Y}<br>Plate: <b>%{y:.2f}%</b><extra></extra>",
    });
  }
  if (selected.has("Mix")) {
    traces.push({
      type: "scatter" as const,
      mode: "lines+markers+text" as const,
      name: "Mix (Coil + Plate)",
      x: series.mix.map((d) => d.date),
      y: series.mix.map((d) => d.weighted_repair_ratio * 100),
      text: lastPointOnly(series.mix),
      textposition: "bottom center" as const,
      textfont: { size: 11, color: COLOR_MIX },
      line: { width: 2, color: COLOR_MIX, dash: "dash" as const },
      marker: { size: 6, color: COLOR_MIX },
      hovertemplate: "%{x|%d.%m.%Y}<br>Mix: <b>%{y:.2f}%</b><extra></extra>",
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Repair Rate Trend by Production Type</h2>
        <div className="flex flex-wrap gap-4">
          {TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-4 w-4 rounded border-slate-300"
                style={{ accentColor: opt.color }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {traces.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">
          En az bir üretim tipi seçin.
        </p>
      ) : (
        <Plot
          data={traces}
          layout={{
            ...baseLayout,
            showlegend: traces.length > 1,
            legend: { orientation: "h", y: -0.2 },
            yaxis: {
              showgrid: true,
              gridcolor: GRID_LINE,
              zeroline: false,
              ticksuffix: "%",
              tickfont: { size: 11, color: AXIS_TEXT },
            },
          }}
          config={config}
          style={{ width: "100%", height: "420px" }}
          useResizeHandler
        />
      )}
    </div>
  );
}

// Pareto charts are one of the few universally-recognized, legitimate uses
// of a dual y-axis -- the cumulative-% line has a fixed, self-explanatory
// 0-100 range that reads as an overlay on the bars, not a second unrelated
// measurement competing for the same axis. dash_app already uses this
// convention; kept for parity rather than reinvented.
function ParetoChart({
  title,
  data,
  valueLabel,
  hoverValueFormat,
}: {
  title: string;
  data: ParetoPoint[];
  valueLabel: string;
  hoverValueFormat: string; // a Plotly/d3 number format spec, e.g. ".2f" or ".2%"
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <Plot
        data={[
          {
            type: "bar",
            name: valueLabel,
            x: data.map((d) => d.label),
            y: data.map((d) => d.value),
            marker: { color: PRIMARY },
            hovertemplate: `%{x}<br>${valueLabel}: <b>%{y:${hoverValueFormat}}</b><extra></extra>`,
          },
          {
            type: "scatter",
            mode: "lines+markers",
            name: "Cumulative %",
            x: data.map((d) => d.label),
            y: data.map((d) => d.cumulativePct),
            yaxis: "y2",
            line: { color: COLOR_MIX, width: 2 },
            marker: { size: 6, color: COLOR_MIX },
            hovertemplate: "%{x}<br>Cumulative: <b>%{y:.2f}%</b><extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          margin: { l: 56, r: 48, t: 8, b: 110 },
          plot_bgcolor: "white",
          paper_bgcolor: "white",
          font: baseFont,
          hoverlabel: { bgcolor: "white", bordercolor: BORDER_LINE, font: { color: "#1e293b", size: 12 } },
          showlegend: true,
          legend: { orientation: "h", y: 1.12, x: 1, xanchor: "right" },
          xaxis: {
            showgrid: false,
            tickangle: -45,
            tickfont: { size: 10, color: AXIS_TEXT },
            linecolor: BORDER_LINE,
          },
          yaxis: {
            title: { text: valueLabel },
            showgrid: true,
            gridcolor: GRID_LINE,
            zeroline: false,
            tickfont: { size: 11, color: AXIS_TEXT },
          },
          yaxis2: {
            title: { text: "Cumulative %" },
            overlaying: "y",
            side: "right",
            range: [0, 105],
            showgrid: false,
            tickfont: { size: 11, color: AXIS_TEXT },
          },
        }}
        config={config}
        style={{ width: "100%", height: "400px" }}
        useResizeHandler
      />
    </div>
  );
}

export function RepairAmountParetoChart({ data }: { data: ParetoPoint[] }) {
  return (
    <ParetoChart
      title="Repair Amount Pareto — Cumulative Contribution (ft, Latest Day)"
      data={data}
      valueLabel="Repair Amount (ft)"
      hoverValueFormat=".2f"
    />
  );
}

export function RepairRatioParetoChart({ data }: { data: ParetoPoint[] }) {
  return (
    <ParetoChart
      title="Repair Ratio Pareto — Cumulative Contribution (Latest Day)"
      data={data.map((d) => ({ ...d, value: d.value * 100 }))}
      valueLabel="Repair Ratio (%)"
      hoverValueFormat=".2f"
    />
  );
}
