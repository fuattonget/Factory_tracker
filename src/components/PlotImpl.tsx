"use client";

import createPlotlyComponent from "react-plotly.js/factory";
// Deliberately the cartesian-only bundle, not the default "plotly.js" --
// that pulls in maplibre-gl (map traces), which has an open critical CVE
// and which this app never uses (line/bar/box charts only). See
// PROJECT_PLAN.md section 3.
import Plotly from "plotly.js-cartesian-dist";

const PlotImpl = createPlotlyComponent(Plotly as never);
export default PlotImpl;
