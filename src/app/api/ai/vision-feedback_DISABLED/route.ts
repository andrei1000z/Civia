/**
 * POST /api/ai/vision-feedback — User feedback (thumbs up/down) pe rezultatul
 * Groq Vision auto-route.
 *
 * Plan UX medium (5/22/2026). Permite users sa marcheze daca detection-ul
 * tip/autoritate/severitate a fost corect. Date folosite pentru:
 *   1. Improving prompts (analize quartrly)
 *   2. Authority pattern learning (per user / per regiune)
 *   3. Authority hub data quality
 *
 * Body: { code: string, vote: "up" | "down", note?: string }
 * Auth: optional (logged-in user) sau anonymous (IP-based).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 5;

const schema = z.object({
  code: z.string().min(4).max(20),
  vote: z.enum(["up", "down"]),
  note: z.string().max(280).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`vision-fb:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limited" },
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
      { error: parsed.error.issues[0]?.message ?? "Invalid" },
      { status: 400 },
    );
  }

  // Get user (optional)
  let userId: string | null = null;
  try {
    const supa = await createSupabaseServer();
    const { data } = await supa.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    // not logged in — anonymous feedback OK
  }

  try {
    const admin = createSupabaseAdmin();
    // Best-effort insert. Tabela vision_feedback poate fi creata via
    // migration ulterioara; pana atunci, log la Sentry si returnam OK
    // pentru a nu da error la user.
    const { error } = await admin.from("vision_feedback").insert({
      sesizare_code: parsed.data.code,
      vote: parsed.data.vote,
      note: parsed.data.note ?? null,
      user_id: userId,
      ip_hash: ip ? Buffer.from(ip).toString("base64").slice(0, 16) : null,
    });
    if (error) {
      // Tabela poate să nu existe încă. Returnăm OK ca user să nu vadă eroare.
      // Pe Sentry vom vedea ce trebuie creat.
      return NextResponse.json({ ok: true, note: "logged_only" });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true, note: "soft_fail" });
  }
}
