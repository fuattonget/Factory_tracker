import Link from "next/link";
import { listProjectStageConfigs, listPipes } from "@/lib/pipes";
import { SignOutButton } from "./sign-out-button";

// Protected by src/proxy.ts (redirects to /admin/login if there's no
// session).
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

      <nav style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
        <Link href="/admin/projects">Projeler ({stageConfigs.length})</Link>
        <Link href="/admin/pipes">Borular ({pipes.length})</Link>
      </nav>
    </main>
  );
}
