import { NextResponse } from "next/server";
import { upsertPipePartProgress } from "@/lib/pipes";

// Lives under /admin/api so src/proxy.ts's "/admin/:path*" matcher covers
// it -- same session gate as /admin/api/pipes. Separate save path from
// upsertPipe: per-feature assembly/weld progress (pipe_part_progress)
// only exists for projects with track_parts_separately = true, and each
// toggle in PipeGrid.tsx's Awaiting Additional Part section saves
// immediately rather than waiting for the page's main Save button.
export async function POST(request: Request) {
  const { pipe_id, feature, assembled_date, welded_date } = (await request.json()) as {
    pipe_id: number;
    feature: string;
    assembled_date: string | null;
    welded_date: string | null;
  };

  try {
    const progress = await upsertPipePartProgress(pipe_id, feature, { assembled_date, welded_date });
    return NextResponse.json({ ok: true, progress });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
