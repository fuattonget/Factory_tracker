import { NextResponse } from "next/server";
import { upsertPipe } from "@/lib/pipes";
import type { PipeInput } from "@/lib/types";

// Lives under /admin/api so src/proxy.ts's "/admin/:path*" matcher covers
// it -- same session gate as every other /admin route, no separate auth
// check needed here.
export async function POST(request: Request) {
  const { pipes } = (await request.json()) as { pipes: PipeInput[] };

  const results = await Promise.all(
    pipes.map(async (pipe) => {
      try {
        const { pipe: saved, warnings } = await upsertPipe(pipe);
        return { ok: true as const, pipe_no: pipe.pipe_no, pipe: saved, warnings };
      } catch (err) {
        return {
          ok: false as const,
          pipe_no: pipe.pipe_no,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return NextResponse.json({ results });
}
