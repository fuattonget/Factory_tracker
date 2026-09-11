import type { NewestPipeRow } from "@/lib/pipeOverview";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function NewestPipesTable({
  title,
  date,
  rows,
}: {
  title: string;
  date: string;
  rows: NewestPipeRow[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">
        {title} — <span className="font-normal text-slate-500">{formatDate(date)}</span>
      </h2>
      <div className="mt-3 max-h-80 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Project</th>
              <th className="py-2 pr-3">Dimensions</th>
              <th className="py-2 pr-3">Pipe No.</th>
              <th className="py-2 pr-3">Repair Amt (ft)</th>
              <th className="py-2 pr-3">Repair Ratio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.project_no}-${r.pipe_no}-${i}`} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-800">{r.project_no}</td>
                <td className="py-1.5 pr-3 text-slate-500">{r.dimensions}</td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-800">{r.pipe_no}</td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-500">
                  {r.repair_amount != null ? r.repair_amount.toFixed(2) : "-"}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-500">
                  {r.repair_ratio != null ? `${(r.repair_ratio * 100).toFixed(2)}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
