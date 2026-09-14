import Link from "next/link";
import { listProjectStageConfigs, listProjectPipeGroupsWithProgress } from "@/lib/pipes";
import { saveProjectStageConfig, archiveProject } from "./actions";
import { GroupsManager } from "./GroupsManager";

const STATUS_BADGE: Record<string, string> = {
  "In Progress": "bg-blue-50 text-blue-700",
  Completed: "bg-emerald-50 text-emerald-700",
  "On Hold": "bg-amber-50 text-amber-700",
};

// Per-project stage config: which of the optional lifecycle stages
// (additional part, coating) apply to this project's work order, plus
// dimension/band-width and planning metadata. Must exist before pipes can
// be added to a project (pipes.project_no is a foreign key into this
// table). See PROJECT_PLAN.md section 5.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupProject?: string }>;
}) {
  const { groupProject } = await searchParams;
  const configs = await listProjectStageConfigs({ includeArchived: true });
  const groupProjectNo = groupProject ?? configs.find((c) => !c.archived)?.project_no ?? null;
  const groups = groupProjectNo ? await listProjectPipeGroupsWithProgress(groupProjectNo) : [];

  return (
    <main>
      <p>
        <Link href="/admin" className="text-sm text-slate-600 hover:text-slate-900">
          &larr; Admin
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Projects</h1>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              {["Project No", "Size", "Band Width", "Production Type", "Status", "Customer", "Add'l Part", "Coating", ""].map(
                (h) => (
                  <th key={h} className="px-4 py-2.5">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  No projects yet.
                </td>
              </tr>
            )}
            {configs.map((c) => (
              <tr key={c.project_no} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {c.project_no}
                  {c.archived && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Archived
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {c.diameter != null ? `Ø${c.diameter}"` : ""}
                  {c.wall_thickness != null ? ` x ${c.wall_thickness}"` : ""}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.band_width != null ? `${c.band_width}"` : ""}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.production_type ?? ""}</td>
                <td className="px-4 py-2.5">
                  {c.project_status && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.project_status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {c.project_status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.customer_name ?? ""}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.requires_additional_part ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.requires_coating ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 text-right">
                  <form action={archiveProject}>
                    <input type="hidden" name="project_no" value={c.project_no} />
                    <input type="hidden" name="archived" value={c.archived ? "false" : "true"} />
                    <button type="submit" className="text-xs font-medium text-blue-600 hover:underline">
                      {c.archived ? "Unarchive" : "Archive"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Add / update project</h2>
        <form action={saveProjectStageConfig} className="mt-4 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col text-xs text-slate-500 sm:col-span-2">
            Project No
            <input
              name="project_no"
              required
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Diameter (inch, e.g. 36)
            <input
              name="diameter"
              type="number"
              step="any"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Wall Thickness (inch, e.g. 0.625)
            <input
              name="wall_thickness"
              type="number"
              step="any"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Band Width (inch, e.g. 59)
            <input
              name="band_width"
              type="number"
              step="any"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Customer
            <input
              name="customer_name"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Production Type
            <select
              name="production_type"
              defaultValue=""
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">—</option>
              <option value="Coil">Coil</option>
              <option value="Plate">Plate</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            Project Status
            <select
              name="project_status"
              defaultValue="In Progress"
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" name="requires_additional_part" className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
            This project has an additional part (assembly + weld)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" name="requires_coating" className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
            This project has coating
          </label>
          <label className="flex flex-col text-xs text-slate-500 sm:col-span-2">
            Note (optional)
            <input
              name="notes"
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            className="mt-1 w-fit rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 sm:col-span-2"
          >
            Save
          </button>
        </form>
      </div>

      {configs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Groups</h2>
          <p className="mt-1 text-xs text-slate-500">
            Break a project&apos;s total pipe count into sub-groups (e.g. &quot;10 units, 55ft, Clutch&quot;) — the
            Pipes page&apos;s Group picker reads from these.
          </p>
          <form method="GET" className="mt-3 flex items-center gap-3">
            <select
              name="groupProject"
              defaultValue={groupProjectNo ?? undefined}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {configs.map((c) => (
                <option key={c.project_no} value={c.project_no}>
                  {c.project_no}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Go
            </button>
          </form>

          {groupProjectNo && (
            <div className="mt-4">
              <GroupsManager projectNo={groupProjectNo} groups={groups} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
