import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Civic Streak: ține trackul de „zile consecutive cu acțiune civică".
 *
 * Logică: dacă ultima acțiune a fost ieri → +1 streak. Dacă a fost azi
 * deja → no-op. Dacă a fost > 2 zile → reset la 1. Folosim ziua calendaristică
 * la timezone Europe/Bucharest pentru consistență.
 *
 * Apelat de orice acțiune civică:
 *   - createSesizare → bumpStreak(user_id)
 *   - vote sesizare → bumpStreak(user_id)
 *   - sign petiție → bumpStreak(user_id)
 *   - comment → bumpStreak(user_id)
 *
 * Non-blocking: dacă fail, log + continuă. Streak e nice-to-have, nu critic.
 */

function startOfDayBucharest(date: Date): Date {
  // Europe/Bucharest e UTC+2/+3. Folosim un truc simplu: tăiem la 22:00 UTC
  // = miezul nopții RO vara. Aproximare ok pentru streak (off by 1h o dată/an
  // la schimbarea de ora — irrelevant pentru streak counter).
  const d = new Date(date);
  d.setUTCHours(22, 0, 0, 0);
  if (date.getUTCHours() < 22) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60_000));
}

export async function bumpCivicStreak(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const admin = createSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("civic_streak_days, civic_streak_last_action, civic_total_actions")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return;

    const now = new Date();
    const today = startOfDayBucharest(now);
    const lastActionTs = (profile as { civic_streak_last_action?: string | null }).civic_streak_last_action;
    const lastDay = lastActionTs ? startOfDayBucharest(new Date(lastActionTs)) : null;
    let streak = (profile as { civic_streak_days?: number }).civic_streak_days ?? 0;
    const totalActions = ((profile as { civic_total_actions?: number }).civic_total_actions ?? 0) + 1;

    if (!lastDay) {
      streak = 1;
    } else {
      const gap = daysBetween(lastDay, today);
      if (gap === 0) {
        // Already counted today — total acum +1, streak rămâne.
      } else if (gap === 1) {
        streak += 1;
      } else if (gap > 1) {
        streak = 1; // reset
      }
    }

    await admin
      .from("profiles")
      .update({
        civic_streak_days: streak,
        civic_streak_last_action: now.toISOString(),
        civic_total_actions: totalActions,
      })
      .eq("id", userId);
  } catch {
    // silent — streak e nice-to-have
  }
}
