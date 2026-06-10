import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { computeStreak } from "@/lib/badges";
import { sendPushToUsers } from "@/lib/push/web-push-client";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streak-at-risk push reminder — audit item #110 retention loop.
 *
 * Runs daily (chained from /api/sesizari/reminders cron). For each user
 * with an active streak ≥ 3 days who has had NO civic action today,
 * send a push notification:
 *   "🔥 Streak-ul tău de X zile e în pericol — o acțiune azi îl menține."
 *
 * Why ≥ 3: smaller streaks have no emotional sunk-cost, push annoys.
 * Why "no action today": user already invested today doesn't need it.
 * Limit: 200 users per run (Vercel function timeout safety).
 *
 * Auth: Bearer ${CRON_SECRET} (Vercel cron) or admin session.
 *
 * POST trigger: keep idempotent — same user gets at most one push/day
 * via streak_reminder_log table (tracked per user_id + day).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = verifyBearer(auth, cronSecret);

  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);

  // Candidates: users with at least one civic action in the last 14 days.
  // Pulling sesizari + votes + comments timestamps for the window.
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [sesizariRes, commentsRes] = await Promise.all([
    admin.from("sesizari").select("user_id, created_at").gte("created_at", since).not("user_id", "is", null),
    admin.from("sesizare_comments").select("user_id, created_at").gte("created_at", since),
  ]);

  if (sesizariRes.error || commentsRes.error) {
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 },
    );
  }

  // Group timestamps per user.
  const perUser = new Map<string, string[]>();
  const add = (rows: { user_id: string | null; created_at: string }[] | null) => {
    if (!rows) return;
    for (const r of rows) {
      if (!r.user_id) continue;
      const arr = perUser.get(r.user_id) ?? [];
      arr.push(r.created_at);
      perUser.set(r.user_id, arr);
    }
  };
  add(sesizariRes.data as { user_id: string | null; created_at: string }[]);
  add(commentsRes.data as { user_id: string | null; created_at: string }[]);

  // Filter: streak ≥ 3, no action today.
  const candidates: Array<{ userId: string; streak: number }> = [];
  for (const [userId, timestamps] of perUser) {
    const hasTodayAction = timestamps.some((t) => t.slice(0, 10) === todayIso);
    if (hasTodayAction) continue;
    const streak = computeStreak(timestamps);
    if (streak < 3) continue;
    candidates.push({ userId, streak });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, candidates: 0 });
  }

  // Cap to 200 to stay within function timeout.
  candidates.sort((a, b) => b.streak - a.streak);
  const toNotify = candidates.slice(0, 200);

  let sent = 0;
  for (const { userId, streak } of toNotify) {
    try {
      await sendPushToUsers([userId], {
        title: `🔥 Streak-ul tău de ${streak} zile e în pericol`,
        body: "O singură acțiune civică azi îl menține. Trimite o sesizare sau votează una.",
        url: "/sesizari",
        tag: `streak-at-risk-${todayIso}`,
      });
      sent += 1;
    } catch (e) {
      Sentry.captureException(e, {
        tags: { route: "streaks.at-risk", user_id: userId },
      });
    }
  }

  return NextResponse.json({ ok: true, sent, candidates: candidates.length });
}
