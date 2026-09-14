import Link from "next/link";
import { listProjectStageConfigs, listPipes } from "@/lib/pipes";

// Protected by src/proxy.ts (redirects to /admin/login if there's no
// session). Header/nav come from the (protected) route group's layout.
export default async function AdminHome() {
  const [stageConfigs, pipes] = await Promise.all([
    listProjectStageConfigs(),
    listPipes(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>

      {/* The daily workflow's main entry point -- today's report covers
          yesterday's floor activity, entered here every day. */}
      <Link
        href="/admin/pipes"
        className="mt-6 flex items-center justify-between rounded-2xl bg-blue-600 p-5 text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <div>
          <p className="text-lg font-semibold">Veri Girişi Yap</p>
          <p className="mt-0.5 text-sm text-blue-100">Günlük rapordaki boruları işle</p>
        </div>
        <span aria-hidden className="text-2xl">
          &rarr;
        </span>
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/projects"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projeler</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{stageConfigs.length}</p>
        </Link>
        <Link
          href="/admin/pipes"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Borular</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{pipes.length}</p>
        </Link>
      </div>
    </div>
  );
}
