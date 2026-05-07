import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const revalidate = 900; // 5 min cache

interface SesRow {
  sector: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export async function GET(req: Request) {
  const rl = await rateLimitAsync(`stats-scorecard:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("sesizari_feed")
      .select("sector, status, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const rows = (data ?? []) as unknown as SesRow[];
    const sectors = ["S1", "S2", "S3", "S4", "S5", "S6"];
    const stats = sectors.map((sector) => {
      const filtered = rows.filter((r) => r.sector === sector);
      const total = filtered.length;
      const rezolvate = filtered.filter((r) => r.status === "rezolvat").length;
      const in_lucru = filtered.filter((r) => r.status === "in-lucru").length;
      const noi = filtered.filter((r) => r.status === "nou").length;
      const percent_rezolvate = total > 0 ? Math.round((rezolvate / total) * 100) : 0;

      // Average resolution time for rezolvate sesizari (where we have resolved_at)
      const withResolution = filtered.filter((r) => r.resolved_at && r.status === "rezolvat");
      const avg_days = withResolution.length > 0
        ? Math.round(
            withResolution.reduce((sum, r) => {
              const days = (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 86400000;
              return sum + days;
            }, 0) / withResolution.length
          )
        : null;

      return { sector, total, rezolvate, in_lucru, noi, percent_rezolvate, avg_days };
    });

    return NextResponse.json(
      { data: stats },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
