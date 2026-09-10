import { createServiceRoleClient } from "@/lib/supabase/server";

// Proves the server-side Supabase connection works end to end, reading the
// exact same live data dash_app uses. Replace this page once Phase 1's real
// admin/viewing UI exists — see PROJECT_PLAN.md.
export default async function Home() {
  const supabase = createServiceRoleClient();

  const { count: repairRatesCount, error: repairRatesError } = await supabase
    .from("repair_rates")
    .select("*", { count: "exact", head: true });

  const { count: pipeCount, error: pipeError } = await supabase
    .from("pipe_repair_details")
    .select("*", { count: "exact", head: true });

  const { data: latestRows, error: latestError } = await supabase
    .from("repair_rates")
    .select("date, project_no, dimensions, qty, repair_ratio")
    .order("date", { ascending: false })
    .limit(5);

  const error = repairRatesError ?? pipeError ?? latestError;

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Factory Tracker</h1>
      <p style={{ color: "#666" }}>
        Connected to the same Supabase project as dash_app. See{" "}
        <code>PROJECT_PLAN.md</code> before building on this.
      </p>

      {error ? (
        <p style={{ color: "crimson" }}>Supabase error: {error.message}</p>
      ) : (
        <>
          <ul>
            <li>
              <strong>repair_rates</strong> rows: {repairRatesCount}
            </li>
            <li>
              <strong>pipe_repair_details</strong> rows: {pipeCount}
            </li>
          </ul>

          <h2>Most recent repair_rates rows</h2>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["date", "project_no", "dimensions", "qty", "repair_ratio"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ccc",
                        padding: "4px 12px",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {latestRows?.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: "4px 12px" }}>{row.date}</td>
                  <td style={{ padding: "4px 12px" }}>{row.project_no}</td>
                  <td style={{ padding: "4px 12px" }}>{row.dimensions}</td>
                  <td style={{ padding: "4px 12px" }}>{row.qty}</td>
                  <td style={{ padding: "4px 12px" }}>
                    {row.repair_ratio != null
                      ? `${(row.repair_ratio * 100).toFixed(2)}%`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
