"use client";

import dynamic from "next/dynamic";

// plotly.js touches the DOM at import time, so it can only load in the
// browser -- ssr:false keeps it out of the Node-side render entirely
// (same class of issue as the react-data-grid/Node-version fix earlier).
const Plot = dynamic(() => import("./PlotImpl"), { ssr: false });

export default Plot;
