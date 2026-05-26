import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import {
  upsertVote,
  removeVote,
  upsertVoteAnon,
  removeVoteAnon,
  getSesizareByCode,
} from "@/lib/sesizari/repository";
import { createSupabaseServer } from "@/lib/supabase/server";
import { invalidateSesizariCache } from "@/lib/cached-queries";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const voteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(1), z.literal(0)]),
});

/**
 * 2026-05-26 — Vote anonim (fără cont). Dedup pe ip_hash.
 * Folosim daily-rotating salt din analytics (același ca visitor ID)
 * ca să ne aliniem cu GDPR: hash devine ireversibil după 24h.
 * Trade-off: după 24h salt rotation, același IP poate vota din nou.
 * Acceptabil — nu e democrație formală, e sprijin vizual public.
 */
async function hashIpForVote(ip: string): Promise<string> {
  // Folosim un salt fix pentru vote dedup (vs daily-salt analytics).
  // Asta ca un IP să nu poată vota de 2× pe aceeași sesizare cross-day.
  const secret = process.env.CRON_SECRET ?? "civia-vote-salt-fallback";
  return createHash("sha256")
    .update(secret)
    .update(":vote:")
    .update(ip)
    .digest("hex")
    .slice(0, 16);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    // 2026-05-26 — Vote ANONIM enabled. Dacă !user → folosim ip_hash.
    // Pentru rate-limit + dedup. Authenticated path rămâne identic.
    const isAuth = !!user;
    const ipHash = isAuth ? null : await hashIpForVote(getClientIp(req));

    const rlKey = isAuth ? `vote:${user.id}` : `vote-anon:${ipHash}`;
    const rl = await rateLimitAsync(rlKey, { limit: 20, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Prea multe voturi. Încearcă peste un minut." },
        { status: 429 }
      );
    }

    const sesizare = await getSesizareByCode(code);
    if (!sesizare) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { value } = voteSchema.parse(body);

    if (isAuth && user) {
      // Path authenticated — neschimbat
      if (value === 0) {
        await removeVote({ sesizareId: sesizare.id, userId: user.id });
      } else {
        await upsertVote({ sesizareId: sesizare.id, userId: user.id, value });
        // 2026-05-24 (P3.26 fix) — bump civic streak doar pe vote+ (nu pe remove).
        const { bumpCivicStreak } = await import("@/lib/civic-streak");
        void bumpCivicStreak(user.id);
      }
    } else if (ipHash) {
      // Path anonim — dedup pe ip_hash
      if (value === 0) {
        await removeVoteAnon({ sesizareId: sesizare.id, ipHash });
      } else {
        await upsertVoteAnon({ sesizareId: sesizare.id, ipHash, value });
      }
    }
    invalidateSesizariCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
