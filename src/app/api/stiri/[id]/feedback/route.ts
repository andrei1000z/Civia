/**
 * POST /api/stiri/[id]/feedback
 *
 * User-ii reacționează la sinteza AI de pe pagina stirii cu 👍/👎.
 *   - Like → increment counter Redis (analytics, no DB row, low noise)
 *   - Dislike + comment → insert în feedback_submissions cu
 *     topic="stire-dislike" + page_path=/stiri/{id}. Admin vede în
 *     /admin/feedback alături de restul mesajelor.
 *
 * Rate limit: 30/oră per IP (mai relaxat decât /api/feedback/submit
 * fiindcă likes sunt acțiuni rapide, casual).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { analyticsRedis } from "@/lib/analytics/redis";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["like", "dislike"]),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`stire-feedback:${ip}`, {
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: `Prea multe reacții. Așteaptă ${Math.ceil(rl.resetIn / 1000)}s.` },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }

  const { kind, comment } = parsed.data;

  // Identitate utilizator (best-effort — feedback poate fi anonim)
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verifică că stirea există (evită spam contra ID-uri inexistente)
  const adminDb = createSupabaseAdmin();
  const { data: stire } = await adminDb
    .from("stiri_cache")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!stire) {
    return NextResponse.json({ error: "Stire negăsită" }, { status: 404 });
  }

  // Increment counter în Redis (best-effort, non-blocking dacă Redis lipsește)
  if (analyticsRedis) {
    try {
      await analyticsRedis.hincrby(`civia:stire:feedback:${id}`, kind, 1);
      // Plus expire 90 days ca să nu balooneze Redis-ul
      await analyticsRedis.expire(`civia:stire:feedback:${id}`, 90 * 86400);
    } catch {
      /* ignore */
    }
  }

  // Dislike cu comment → DB insert pentru admin review
  if (kind === "dislike" && comment && comment.length >= 3) {
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    const { error: insErr } = await adminDb.from("feedback_submissions").insert({
      // Includem titlul stirii în text ca admin să-l vadă fără să caute
      text: `[Sinteză cu probleme — „${(stire.title as string).slice(0, 100)}"]\n\n${comment}`,
      email: user?.email ?? null,
      topic: "stire-dislike",
      page_path: `/stiri/${id}`,
      ip_hash: ipHash,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/stiri/[id]/feedback — întoarce counter-ele agregate (likes/dislikes)
 * pentru afișare pe card („178 oameni au apreciat sinteza").
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!analyticsRedis) {
    return NextResponse.json({ likes: 0, dislikes: 0 });
  }
  try {
    const raw = await analyticsRedis.hgetall(`civia:stire:feedback:${id}`);
    const map = (raw ?? {}) as Record<string, string | number>;
    return NextResponse.json({
      likes: Number(map.like ?? 0),
      dislikes: Number(map.dislike ?? 0),
    });
  } catch {
    return NextResponse.json({ likes: 0, dislikes: 0 });
  }
}
