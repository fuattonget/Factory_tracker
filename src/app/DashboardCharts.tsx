"use client";

import { useState } from "react";
import Plot from "@/components/Plot";
import type {
  DailyAmountPoint,
  DailyRatioPoint,
  ProductionTypeTrendSeries,
  ParetoPoint,
  WorstProjectPoint,
  SkelpImpactPoint,
} from "@/lib/dashboard";
import type { BacklogTrendPoint } from "@/lib/pipeOverview";

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
const COLOR_DANGER = "#dc2626";

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

type SkelpSeries = "Excl" | "Incl";
const SKELP_OPTIONS: { value: SkelpSeries; label: string; color: string }[] = [
  { value: "Excl", label: "Excl. Skelp", color: PRIMARY },
  { value: "Incl", label: "Incl. Skelp", color: COLOR_MIX },
];

// Ports dash_app's current render_overall_trend_chart -- an Excl./Incl.
// Skelp checklist toggle added to this chart after the initial port (see
// PROJECT_PLAN.md), so both weighted-ratio series (src/lib/dashboard.ts's
// dailyWeightedRepairRatios/dailyWeightedRepairRatiosInclSkelp) show
// together by default. Every point is labeled (not just the last one,
// unlike ProductionTypeTrendChart below) -- matches dash_app's own current
// choice for this specific chart; kept for parity rather than redesigned.
export function RepairRateTrendChart({
  dataExcl,
  dataIncl,
}: {
  dataExcl: DailyRatioPoint[];
  dataIncl: DailyRatioPoint[];
}) {
  const [selected, setSelected] = useState<Set<SkelpSeries>>(new Set(["Excl", "Incl"]));

  function toggle(series: SkelpSeries) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  }

  const traces = [];
  if (selected.has("Excl")) {
    traces.push({
      type: "scatter" as const,
      mode: "lines+markers+text" as const,
      name: "Excl. Skelp",
      x: dataExcl.map((d) => d.date),
      y: dataExcl.map((d) => d.weighted_repair_ratio * 100),
      text: dataExcl.map((d) => `${(d.weighted_repair_ratio * 100).toFixed(2)}%`),
      textposition: "top center" as const,
      textfont: { size: 10, color: PRIMARY },
      line: { color: PRIMARY, width: 3 },
      marker: { size: 6, color: PRIMARY },
      hovertemplate: "%{x|%d.%m.%Y}<br>Excl. Skelp: <b>%{y:.2f}%</b><extra></extra>",
    });
  }
  if (selected.has("Incl")) {
    traces.push({
      type: "scatter" as const,
      mode: "lines+markers+text" as const,
      name: "Incl. Skelp",
      x: dataIncl.map((d) => d.date),
      y: dataIncl.map((d) => d.weighted_repair_ratio * 100),
      text: dataIncl.map((d) => `${(d.weighted_repair_ratio * 100).toFixed(2)}%`),
      textposition: "bottom center" as const,
      textfont: { size: 10, color: COLOR_MIX },
      line: { color: COLOR_MIX, width: 3, dash: "dash" as const },
      marker: { size: 6, color: COLOR_MIX },
      hovertemplate: "%{x|%d.%m.%Y}<br>Incl. Skelp: <b>%{y:.2f}%</b><extra></extra>",
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Overall Repair Rate Trend</h2>
        <div className="flex flex-wrap gap-4">
          {SKELP_OPTIONS.map((opt) => (
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
        <p className="py-16 text-center text-sm text-slate-400">Select at least one series to display.</p>
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
          style={{ width: "100%", height: "320px" }}
          useResizeHandler
        />
      )}
    </div>
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
          Select at least one production type.
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

// Ports "Top 10 Projects by Repair Ratio (Latest Day)" -- a plain
// horizontal bar (no cumulative line, unlike the Pareto charts above),
// worst offenders on top. The Qty label centered inside each bar (skipped
// below ~15% of the widest bar, dash_app's own threshold for "won't fit")
// ports _add_bar_value_annotations via Plotly's layout.annotations rather
// than a second trace.
export function WorstProjectsChart({ data }: { data: WorstProjectPoint[] }) {
  const sorted = [...data].reverse(); // reversed: Plotly draws horizontal bars bottom-up
  const maxRatio = Math.max(0, ...sorted.map((d) => d.ratio));
  const qtyAnnotations = sorted
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => maxRatio > 0 && d.ratio >= maxRatio * 0.15)
    .map(({ d, i }) => ({
      x: d.ratio / 2,
      y: i,
      text: `Qty ${d.qty}`,
      showarrow: false,
      font: { size: 10, color: "white" },
      xanchor: "center" as const,
    }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Top 10 Projects by Repair Ratio (Latest Day)</h2>
      <p className="mb-3 text-xs text-slate-400">The number inside each bar is the pipe quantity (Qty).</p>
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            x: sorted.map((d) => d.ratio),
            y: sorted.map((d) => d.label),
            marker: { color: PRIMARY },
            texttemplate: "%{x:.2%}",
            textposition: "outside",
            textfont: { size: 11 },
            hovertemplate: "%{y}<br>Repair Ratio: <b>%{x:.2%}</b><extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          margin: { l: 140, r: 40, t: 8, b: 44 },
          plot_bgcolor: "white",
          paper_bgcolor: "white",
          font: baseFont,
          hoverlabel: { bgcolor: "white", bordercolor: BORDER_LINE, font: { color: "#1e293b", size: 12 } },
          annotations: qtyAnnotations,
          xaxis: {
            showgrid: true,
            gridcolor: GRID_LINE,
            zeroline: false,
            tickformat: ".1%",
            tickfont: { size: 11, color: AXIS_TEXT },
          },
          yaxis: {
            showgrid: false,
            tickfont: { size: 11, color: AXIS_TEXT },
            automargin: true,
          },
        }}
        config={config}
        style={{ width: "100%", height: "420px" }}
        useResizeHandler
      />
    </div>
  );
}

// Ports the two "Skelp-End Weld Impact" stacked-bar charts -- the base
// metric (repair ratio or repair amount, whichever the caller passes) as
// the bottom segment, the extra "impact" the B.E./skelp-end welds add on
// top as the second segment. Plotly hides a stacked-bar's inside text
// automatically when a segment is too small to fit it, so unlike
// WorstProjectsChart above this doesn't need a manual size-threshold
// fallback -- one fewer thing to keep in sync with the data.
function SkelpImpactChart({
  title,
  data,
  baseLabel,
  impactLabel,
  valueFormat,
}: {
  title: string;
  data: SkelpImpactPoint[];
  baseLabel: string;
  impactLabel: string;
  valueFormat: string; // a Plotly/d3 number format spec, e.g. ".2f" or ".2%"
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <Plot
        data={[
          {
            type: "bar",
            name: baseLabel,
            x: data.map((d) => d.label),
            y: data.map((d) => d.base),
            marker: { color: PRIMARY },
            texttemplate: `%{y:${valueFormat}}`,
            textposition: "inside",
            insidetextfont: { size: 11, color: "white" },
            hovertemplate: `%{x}<br>${baseLabel}: <b>%{y:${valueFormat}}</b><extra></extra>`,
          },
          {
            type: "bar",
            name: impactLabel,
            x: data.map((d) => d.label),
            y: data.map((d) => d.impact),
            marker: { color: COLOR_MIX },
            texttemplate: `+%{y:${valueFormat}}`,
            textposition: "inside",
            insidetextfont: { size: 11, color: "white" },
            hovertemplate: `%{x}<br>${impactLabel}: <b>+%{y:${valueFormat}}</b><extra></extra>`,
          },
        ]}
        layout={{
          barmode: "stack",
          autosize: true,
          margin: { l: 56, r: 16, t: 8, b: 90 },
          plot_bgcolor: "white",
          paper_bgcolor: "white",
          font: baseFont,
          hoverlabel: { bgcolor: "white", bordercolor: BORDER_LINE, font: { color: "#1e293b", size: 12 } },
          showlegend: true,
          legend: { orientation: "h", y: 1.12, x: 1, xanchor: "right" },
          xaxis: {
            showgrid: false,
            tickangle: -25,
            tickfont: { size: 10, color: AXIS_TEXT },
            linecolor: BORDER_LINE,
          },
          yaxis: {
            showgrid: true,
            gridcolor: GRID_LINE,
            zeroline: false,
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

export function SkelpImpactRatioChart({ data }: { data: SkelpImpactPoint[] }) {
  return (
    <SkelpImpactChart
      title="Skelp-End Weld Impact on Repair Ratio (Top 5, Latest Day)"
      data={data.map((d) => ({ ...d, base: d.base * 100, impact: d.impact * 100 }))}
      baseLabel="Repair Ratio"
      impactLabel="Skelp Impact"
      valueFormat=".2f"
    />
  );
}

export function SkelpImpactAmountChart({ data }: { data: SkelpImpactPoint[] }) {
  return (
    <SkelpImpactChart
      title="Skelp-End Weld Impact on Repair Amount (ft, Top 5, Latest Day)"
      data={data}
      baseLabel="Repair Amount (ft)"
      impactLabel="Skelp Impact (ft)"
      valueFormat=".2f"
    />
  );
}

function formatDDMMYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

// Ports render_dashboard's "Backlog Trend" chart -- grouped Produced/
// Repaired bars plus a Total Stock line, all on ONE shared y-axis (not a
// second axis) per dash_app's own explicit choice ("per request" in the
// Python comment). Categorical x-axis (not a real date axis) -- with very
// few real days in the window, a continuous date axis infers bogus
// bar-width/spacing; category ticks sidestep that entirely.
export function BacklogTrendChart({ data }: { data: BacklogTrendPoint[] }) {
  const labels = data.map((d) => formatDDMMYY(d.date));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Backlog Trend</h2>
      <Plot
        data={[
          {
            type: "bar",
            name: "Produced",
            x: labels,
            y: data.map((d) => d.produced),
            marker: { color: COLOR_MIX },
            texttemplate: "%{y}",
            textposition: "outside",
            hovertemplate: "%{x}<br>Produced: <b>%{y}</b><extra></extra>",
          },
          {
            type: "bar",
            name: "Repaired",
            x: labels,
            y: data.map((d) => d.repaired),
            marker: { color: COLOR_COIL },
            texttemplate: "%{y}",
            textposition: "outside",
            hovertemplate: "%{x}<br>Repaired: <b>%{y}</b><extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines+markers+text",
            name: "Total Stock / Remaining Pipes",
            x: labels,
            y: data.map((d) => d.stock),
            line: { color: COLOR_DANGER, width: 3 },
            marker: { size: 8, color: COLOR_DANGER, line: { color: "white", width: 1 } },
            text: data.map((d) => (d.stock != null ? String(d.stock) : "")),
            textposition: "top center",
            textfont: { color: COLOR_DANGER },
            hovertemplate: "%{x}<br>Total Stock: <b>%{y}</b> pipes<extra></extra>",
            connectgaps: false,
          },
        ]}
        layout={{
          barmode: "group",
          autosize: true,
          margin: { l: 56, r: 16, t: 8, b: 60 },
          plot_bgcolor: "white",
          paper_bgcolor: "white",
          font: baseFont,
          hoverlabel: { bgcolor: "white", bordercolor: BORDER_LINE, font: { color: "#1e293b", size: 12 } },
          showlegend: true,
          legend: { orientation: "h", y: 1.15, x: 1, xanchor: "right" },
          xaxis: {
            type: "category",
            showgrid: false,
            tickangle: -45,
            tickfont: { size: 11, color: AXIS_TEXT },
            linecolor: BORDER_LINE,
          },
          yaxis: {
            title: { text: "Pipe Count" },
            rangemode: "tozero",
            showgrid: true,
            gridcolor: GRID_LINE,
            zeroline: false,
            tickfont: { size: 11, color: AXIS_TEXT },
          },
        }}
        config={config}
        style={{ width: "100%", height: "380px" }}
        useResizeHandler
      />
    </div>
  );
}
