import type { BacklogTrendPoint } from "@/lib/pipeOverview";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Ports pages/home.py:_render_dashboard_inner's daily_pipe_table -- the
// same numbers as the Backlog Trend chart, scannable without reading bar
// heights off an axis. Newest day first, same as the Python's
// `.iloc[::-1]`.
export function BacklogDetailTable({ data }: { data: BacklogTrendPoint[] }) {
  const rows = [...data].reverse();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Backlog Trend — Daily Detail</h2>
      <div className="mt-3 max-h-80 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Produced</th>
              <th className="py-2 pr-3">Repaired</th>
              <th className="py-2 pr-3">Net</th>
              <th className="py-2 pr-3">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-800">{formatDate(r.date)}</td>
                <td className="py-1.5 pr-3 tabular-nums font-semibold text-orange-600">{r.produced}</td>
                <td className="py-1.5 pr-3 tabular-nums font-semibold text-blue-600">{r.repaired}</td>
                <td
                  className={`py-1.5 pr-3 tabular-nums ${
                    r.net < 0 ? "text-emerald-600" : r.net > 0 ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  {r.net > 0 ? `+${r.net}` : r.net}
                </td>
                <td className="py-1.5 pr-3 tabular-nums font-bold text-slate-800">{r.stock ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
