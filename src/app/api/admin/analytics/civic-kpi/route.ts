import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";

export const dynamic = "force-dynamic";

/**
 * 2026-05-25 #32 + #36 + #37 — Civic North-Star KPIs derived din SQL.
 *
 * Pe care le calculăm:
 *   - #37 county-coverage: % din 42 județe cu ≥1 sesizare în ultima lună
 *   - #36 multi-surface: % users registered activi pe ≥2 din
 *     {sesizari, petitii, harti} în ultimele 30 zile
 *   - #32 time-to-first-draft: median ms de la prima accesare formular
 *     până la primul AI improve success (calculat din funnel events
 *     în Redis, dar serv-ul nu îl agregă încă — placeholder pentru
 *     viitor; momentan returnam 0)
 *
 * Endpoint admin-only, cached 5min via Cache-Control.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const admin = createSupabaseAdmin();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  // #37 — County coverage: county-uri unice cu sesizari în ultimele 30 zile.
  // SELECT DISTINCT county FROM sesizari WHERE created_at > T-30d
  const { data: countyRows } = await admin
    .from("sesizari")
    .select("county")
    .gte("created_at", thirtyDaysAgo)
    .not("county", "is", null);

  const activeCounties = new Set<string>();
  for (const r of (countyRows ?? []) as { county: string | null }[]) {
    if (r.county) activeCounties.add(r.county.toUpperCase());
  }
  const countyCoverage = {
    activeCount: activeCounties.size,
    totalCount: ALL_COUNTIES.length,
    pct: Math.round((activeCounties.size / ALL_COUNTIES.length) * 100),
    dead: ALL_COUNTIES.filter((c) => !activeCounties.has(c.id)).map((c) => c.id).slice(0, 10),
  };

  // #36 — Multi-surface adoption. Counter per user_id pe fiecare surface
  // din ultimele 30 zile. Surfaces tracked via:
  //   - sesizari.user_id (sesizari) → surface „sesizari"
  //   - petitie_signatures.user_id (petitii) → surface „petitii"
  //   - harti n-are user_id → skip
  // Implementare conservatoare: counted DOAR sesizari + petitii pentru
  // moment. Multi-surface = users care au făcut AMBELE.
  const [sesizariUsersRes, semnaturiUsersRes] = await Promise.all([
    admin
      .from("sesizari")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo)
      .not("user_id", "is", null),
    admin
      .from("petitie_signatures")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo)
      .not("user_id", "is", null),
  ]);
  const sesizariUsers = new Set<string>();
  const petitiiUsers = new Set<string>();
  for (const r of (sesizariUsersRes.data ?? []) as { user_id: string | null }[]) {
    if (r.user_id) sesizariUsers.add(r.user_id);
  }
  for (const r of (semnaturiUsersRes.data ?? []) as { user_id: string | null }[]) {
    if (r.user_id) petitiiUsers.add(r.user_id);
  }
  const unionUsers = new Set<string>([...sesizariUsers, ...petitiiUsers]);
  const multiSurfaceUsers = [...sesizariUsers].filter((u) => petitiiUsers.has(u)).length;
  const multiSurface = {
    sesizariOnly: sesizariUsers.size - multiSurfaceUsers,
    petitiiOnly: petitiiUsers.size - multiSurfaceUsers,
    both: multiSurfaceUsers,
    totalActiveUsers: unionUsers.size,
    pct: unionUsers.size > 0 ? Math.round((multiSurfaceUsers / unionUsers.size) * 100) : 0,
  };

  // #32 — Time-to-first-draft: placeholder. Necesită server-side
  // aggregation a funnel-events („landing"/„start" → „formal-text-generated")
  // în Redis pentru a calcula median. Lăsam ca enhancement viitor —
  // momentan returnam 0 + counters totale pentru reference.
  const { count: formalTextGenerated } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo)
    .not("formal_text", "is", null);

  const timeToFirstDraft = {
    medianMs: 0, // TODO: extract from Redis funnel timestamps
    formalTextGeneratedCount: formalTextGenerated ?? 0,
  };

  // #31 — Closed-loop sesizari snapshot (sesizari rezolvate + cu raspuns oficial
  // în ultimele 30 zile, indicator strong de impact real).
  const { count: closedLoopCount } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("status", "rezolvat")
    .not("official_response", "is", null)
    .gte("resolved_at", thirtyDaysAgo);

  const { count: totalSesizariMonth } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo);

  return NextResponse.json(
    {
      data: {
        countyCoverage,
        multiSurface,
        timeToFirstDraft,
        closedLoop: {
          countLastMonth: closedLoopCount ?? 0,
          totalLastMonth: totalSesizariMonth ?? 0,
          pct:
            (totalSesizariMonth ?? 0) > 0
              ? Math.round(((closedLoopCount ?? 0) / (totalSesizariMonth ?? 1)) * 100)
              : 0,
        },
        generatedAt: new Date().toISOString(),
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=300", // 5 min cache, admin-only
      },
    },
  );
}
