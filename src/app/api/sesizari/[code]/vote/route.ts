import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertVote, removeVote, getSesizareByCode } from "@/lib/sesizari/repository";
import { createSupabaseServer } from "@/lib/supabase/server";
import { invalidateSesizariCache } from "@/lib/cached-queries";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const voteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(1), z.literal(0)]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const rl = await rateLimitAsync(`vote:${user.id}`, { limit: 20, windowMs: 60_000 });
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

    if (value === 0) {
      await removeVote({ sesizareId: sesizare.id, userId: user.id });
    } else {
      await upsertVote({ sesizareId: sesizare.id, userId: user.id, value });
      // 2026-05-24 (P3.26 fix) — bump civic streak doar pe vote+ (nu pe remove).
      // DB dump: 0 active streaks → feature complet dormant. Acum trigger pe
      // toate acțiunile civice (vote/sign/comment/submit).
      const { bumpCivicStreak } = await import("@/lib/civic-streak");
      void bumpCivicStreak(user.id);
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
