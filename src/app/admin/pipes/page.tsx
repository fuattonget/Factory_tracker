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
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <p>
        <Link href="/admin">&larr; Admin</Link>
      </p>
      <h1>Borular</h1>

      {configs.length === 0 ? (
        <p>
          Önce <Link href="/admin/projects">bir proje ekleyin</Link> — borular bir
          projeye bağlı olmak zorunda.
        </p>
      ) : (
        <>
          <form method="GET" style={{ marginBottom: "1rem" }}>
            <label>
              Proje:{" "}
              <select name="project" defaultValue={selected ?? undefined}>
                {configs.map((c) => (
                  <option key={c.project_no} value={c.project_no}>
                    {c.project_no}
                  </option>
                ))}
              </select>
            </label>{" "}
            <button type="submit">Git</button>
          </form>

          {config && <PipeGrid projectNo={config.project_no} config={config} initialPipes={pipes} />}
        </>
      )}
    </main>
  );
}
