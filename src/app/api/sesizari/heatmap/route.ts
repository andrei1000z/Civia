import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min — date relativ statice, sectoare nu se schimbă rapid

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
  let query = admin
    .from("sesizari")
    .select("sector, status")
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .not("sector", "is", null);

  if (!includeAll) {
    // By default arătăm doar sesizările active (not final) ca să vedem
    // probleme curente, nu istoric complet.
    query = query.not("status", "in", "(rezolvat,respins)");
  }

  const { data, error } = await query;
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
