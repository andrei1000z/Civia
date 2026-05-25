import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";
import { analyticsRedis, KEY } from "@/lib/analytics/redis";

export const dynamic = "force-dynamic";

/**
 * 2026-05-25 #4 — GDPR Art. 17 right-to-erasure pentru analytics.
 * Șterge toate datele asociate cu un userId în Redis analytics:
 *   - userMeta:{id}    (first_seen, last_seen, device, country, etc.)
 *   - userRoutes:{id}  (paths visited)
 *   - userCountries:{id}
 *   - userDays:{id}    (per-day activity)
 *   - topUsers ZREM    (leaderboard entry)
 *
 * Apelat la cont delete + manual din /admin pentru user-specific erasure.
 */
async function purgeAnalyticsForUser(userId: string): Promise<void> {
  if (!analyticsRedis) return;
  // Pipeline pentru o singură round-trip Redis.
  const pipe = analyticsRedis.pipeline();
  pipe.del(KEY.userMeta(userId));
  pipe.del(KEY.userRoutes(userId));
  pipe.del(KEY.userCountries(userId));
  pipe.del(KEY.userDays(userId));
  pipe.zrem(KEY.topUsers, userId);
  // Excluded set: dacă user-ul era exclus de la tracking, păstrăm
  // exclusion-ul (e oricum anonim un userId care nu mai există în DB).
  // Actually delete it — clean slate.
  pipe.srem(KEY.excluded, userId);
  await pipe.exec();
}

// GDPR: Right to be forgotten — delete user + anonymize sesizari
export async function DELETE() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  // This is irreversible — an attacker who steals a session shouldn't
  // be able to spam the endpoint; a legit user can only trigger it
  // through a confirm dialog anyway, so 3/hour is generous.
  const rl = await rateLimitAsync(`profile-delete:${user.id}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe încercări de ștergere. Încearcă mai târziu." },
      { status: 429 }
    );
  }

  const admin = createSupabaseAdmin();

  try {
    // Anonymize sesizari (keep public record)
    await admin
      .from("sesizari")
      .update({ user_id: null, author_email: null, author_name: "Utilizator anonim" })
      .eq("user_id", user.id);

    // Delete votes
    await admin.from("sesizare_votes").delete().eq("user_id", user.id);

    // Anonymize comments
    await admin
      .from("sesizare_comments")
      .update({ user_id: null, author_name: "[șters]" })
      .eq("user_id", user.id);

    // Delete profile
    await admin.from("profiles").delete().eq("id", user.id);

    // 2026-05-25 #4 — GDPR Art. 17 also purge analytics in Redis.
    // Best-effort: dacă Redis e down nu blocăm contul delete (DB e
    // single source of truth pentru identitate; analytics e bonus).
    try {
      await purgeAnalyticsForUser(user.id);
    } catch {
      // silent — Redis-down nu trebuie să blocheze GDPR compliance pe SQL
    }

    // Delete auth user (cascades)
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare ștergere";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
