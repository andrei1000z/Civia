import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { analyticsRedis, KEY } from "@/lib/analytics/redis";

export const dynamic = "force-dynamic";

/**
 * 2026-05-25 #4 — GDPR Art. 17 endpoint admin pentru analytics purge.
 *
 * Folosit când:
 *   - User cere manual ștergerea analytics (fără să-și șteargă contul)
 *   - Admin trebuie să răspundă la o cerere GDPR escaladată
 *   - Curățenie post-incident (test users, contaminare data)
 *
 * Diferit de /api/profile/delete care șterge contul în întregime.
 * Acest endpoint NU șterge contul, doar urmele Redis analytics.
 *
 * Returns count șters pentru audit log.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { userId } = await params;
  if (!userId || userId.length < 8 || userId.length > 64) {
    return NextResponse.json({ error: "userId invalid" }, { status: 400 });
  }

  if (!analyticsRedis) {
    return NextResponse.json({ ok: true, noop: "redis-unavailable" });
  }

  // Pipelined delete pentru un singur RTT.
  const pipe = analyticsRedis.pipeline();
  pipe.del(KEY.userMeta(userId));
  pipe.del(KEY.userRoutes(userId));
  pipe.del(KEY.userCountries(userId));
  pipe.del(KEY.userDays(userId));
  pipe.zrem(KEY.topUsers, userId);
  pipe.srem(KEY.excluded, userId);
  const results = await pipe.exec();

  // Count entries effectively deleted (DEL returns 1 if existed, 0 dacă lipsa).
  let deleted = 0;
  for (const r of results) {
    if (typeof r === "number" && r > 0) deleted += r;
  }

  return NextResponse.json({
    ok: true,
    userId,
    deleted,
    purgedBy: gate.userId,
  });
}
