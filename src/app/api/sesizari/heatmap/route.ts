import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// 2026-05-19: 5min → 1h. Heatmap pe sectoare se schimba lent (sesizari noi
// in fiecare sector ~1x/zi). 1h e fresh enough.
export const revalidate = 3600;

/**
 * GET /api/sesizari/heatmap?judet=b
 *
 * Returnează aggregate `{ "S1": 23, "S2": 18, ... "S6": 12 }` pentru hartă caldură
 * pe sectoare (deocamdată doar București). Cu opțional `status` filter
 * (default: doar non-final pentru a vedea problemele active).
 *
 * Pentru județe non-București, returnează `{}` (vom adăuga heatmap pe
 * localități în iterație ulterioară).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const judet = (url.searchParams.get("judet") ?? "b").toLowerCase();
  const includeAll = url.searchParams.get("all") === "1";

  // Doar București are sectoare. Restul = empty pentru moment.
  if (judet !== "b") {
    return NextResponse.json(
      { data: { bySector: {}, total: 0, judet } },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  }

  const admin = createSupabaseAdmin();
  // Supabase v2 type chain devine ~50-deep dupa .eq().eq().not() — TS 5.x
  // produce TS2589 „excessively deep". Tipam ca any local; runtime e OK.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin
    .from("sesizari")
    .select("sector, status")
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .not("sector", "is", null);

  if (!includeAll) {
    query = query.not("status", "in", "(rezolvat,respins)");
  }

  const { data, error } = (await query) as {
    data: Array<{ sector: string | null; status: string }> | null;
    error: { message: string } | null;
  };
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bySector: Record<string, number> = {
    S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0,
  };
  let total = 0;
  for (const row of data ?? []) {
    const s = row.sector as string | null;
    if (!s || !(s in bySector)) continue;
    bySector[s] = (bySector[s] ?? 0) + 1;
    total += 1;
  }

  return NextResponse.json(
    { data: { bySector, total, judet } },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
