import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import * as Sentry from "@sentry/nextjs";
import { loadInterruptions } from "@/lib/intreruperi/store";
import { warmBuildingsForOutages } from "@/lib/intreruperi/buildings";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// 300s budget — 50 outages × 600ms serialized Overpass calls ≈ 30s,
// with headroom for slow upstream.
export const maxDuration = 300;

/**
 * POST /api/intreruperi/buildings/warm
 *
 * Pre-fills the Redis cache with OSM building polygons for every
 * active outage that has coordinates. Used after a fresh deploy or
 * when the user reports the map shows only circles instead of blocks.
 *
 * Auth: CRON_SECRET bearer OR admin session.
 */
async function authorize(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (verifyBearer(auth, cronSecret)) return true;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return (profile as { role?: string } | null)?.role === "admin";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { items } = await loadInterruptions();
    const targets = items
      .filter((i) => i.lat != null && i.lng != null)
      .filter((i) => i.status !== "anulat" && i.status !== "finalizat")
      .map((i) => {
        const pop = i.affectedPopulation ?? i.addresses.length * 200;
        const radiusM = Math.max(
          200,
          Math.min(2500, Math.round(150 * Math.sqrt(pop / 1000))),
        );
        return { id: i.id, lat: i.lat!, lng: i.lng!, radiusM };
      })
      .slice(0, 50);

    const stats = await warmBuildingsForOutages(targets);
    return NextResponse.json({ data: stats });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "intreruperi_warm" } });
    const msg = e instanceof Error ? e.message : "Warm failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
