import Link from "next/link";
import { listProjectStageConfigs, listPipes } from "@/lib/pipes";
import { PipeGrid } from "./PipeGrid";

export default async function PipesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const configs = await listProjectStageConfigs();
  const selected = project ?? configs[0]?.project_no ?? null;
  const pipes = selected ? await listPipes(selected) : [];
  const config = configs.find((c) => c.project_no === selected) ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Borular</h1>
      <p className="mt-1 text-sm text-slate-500">
        Excel tarzı tablo — hücreye çift tıklayıp düzenleyin, sağ alttan yeni satır ekleyin.
      </p>

      {configs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">
            Önce{" "}
            <Link href="/admin/projects" className="font-medium text-blue-600 hover:underline">
              bir proje ekleyin
            </Link>{" "}
            — borular bir projeye bağlı olmak zorunda.
          </p>
        </div>
      ) : (
        <>
          <form method="GET" className="mt-5 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Proje
              <select
                name="project"
                defaultValue={selected ?? undefined}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {configs.map((c) => (
                  <option key={c.project_no} value={c.project_no}>
                    {c.project_no}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Git
            </button>
          </form>

          {config && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <PipeGrid projectNo={config.project_no} config={config} initialPipes={pipes} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
