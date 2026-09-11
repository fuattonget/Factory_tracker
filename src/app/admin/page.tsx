import { listProjectStageConfigs, listPipes } from "@/lib/pipes";
import { SignOutButton } from "./sign-out-button";

// Protected by src/middleware.ts (redirects to /admin/login if there's no
// session) -- proves auth + the new lifecycle tables work end to end.
// Replace with the real Daily Data Entry grid once that's built.
export default async function AdminHome() {
  const [stageConfigs, pipes] = await Promise.all([
    listProjectStageConfigs(),
    listPipes(),
  ]);

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Admin</h1>
        <SignOutButton />
      </div>

      <h2>Project stage config ({stageConfigs.length})</h2>
      <p style={{ color: "#666" }}>
        No projects configured yet — the Daily Data Entry form (next step)
        will let you set requires_additional_part / requires_coating per
        project. Empty here is expected right now.
      </p>

      <h2>Pipes ({pipes.length})</h2>
      <p style={{ color: "#666" }}>
        Empty until the entry form starts writing to the pipes table.
      </p>
    </main>
  );
}
