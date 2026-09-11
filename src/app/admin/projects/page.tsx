import Link from "next/link";
import { listProjectStageConfigs } from "@/lib/pipes";
import { saveProjectStageConfig } from "./actions";

// Per-project stage config: which of the optional lifecycle stages
// (additional part, coating) apply to this project's work order. Must
// exist before pipes can be added to a project (pipes.project_no is a
// foreign key into this table). See PROJECT_PLAN.md section 5.
export default async function ProjectsPage() {
  const configs = await listProjectStageConfigs();

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <p>
        <Link href="/admin">&larr; Admin</Link>
      </p>
      <h1>Projeler</h1>

      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "2rem" }}>
        <thead>
          <tr>
            {["Proje No", "Ek Parça", "Coating", "Not"].map((h) => (
              <th
                key={h}
                style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "6px 10px" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {configs.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "10px", color: "#666" }}>
                Henüz proje eklenmedi.
              </td>
            </tr>
          )}
          {configs.map((c) => (
            <tr key={c.project_no}>
              <td style={{ padding: "6px 10px" }}>{c.project_no}</td>
              <td style={{ padding: "6px 10px" }}>{c.requires_additional_part ? "Evet" : "Hayır"}</td>
              <td style={{ padding: "6px 10px" }}>{c.requires_coating ? "Evet" : "Hayır"}</td>
              <td style={{ padding: "6px 10px" }}>{c.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Proje ekle / güncelle</h2>
      <form
        action={saveProjectStageConfig}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 360 }}
      >
        <label>
          Proje No
          <input name="project_no" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          <input type="checkbox" name="requires_additional_part" /> Bu projede ek parça
          (montaj + kaynak) var
        </label>
        <label>
          <input type="checkbox" name="requires_coating" /> Bu projede coating (boya) var
        </label>
        <label>
          Not (opsiyonel)
          <input name="notes" style={{ display: "block", width: "100%" }} />
        </label>
        <button type="submit">Kaydet</button>
      </form>
    </main>
  );
}
