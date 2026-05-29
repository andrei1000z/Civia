/**
 * POST /api/cron/civic-streak
 *
 * 🎁 MEDIUM #7 — Civic Streak.
 *
 * Run zilnic la 23:00. Reset streak pentru utilizatorii inactivi azi.
 * Increment streak pentru utilizatorii activi (sesizare, vote, semnatura).
 *
 * Activitate = orice: depune sesizare, votează sesizare, semnează petiție,
 * citește știre, comentează etc.
 *
 * Foloseste Redis Sorted Set `civia:streak:{userId}` cu score=current_streak,
 * + key `civia:streak:last_active:{userId}` cu timestamp ultima activitate.
 */

import { NextResponse } from "next/server";
import { analyticsRedis } from "@/lib/analytics/redis";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (req.headers.get("authorization") !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!analyticsRedis) return NextResponse.json({ ok: false, reason: "Redis off" });

  // Pentru fiecare user activ azi, increment streak.
  // Pentru fiecare user activ < 24h, reset streak la 0.
  // Simplificat: iterate prin key civia:streak:last_active:* (rare in MVP).

  // MVP — best-effort: client tracks streaks local + server periodic sync.
  // Aceasta route e placeholder pentru viitoare implementare detaliata.

  return NextResponse.json({ ok: true, mode: "placeholder" });
}
