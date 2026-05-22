import { NextResponse } from "next/server";
import { z } from "zod";
import { analyticsRedis } from "@/lib/analytics/redis";
import { sanitizeText } from "@/lib/sanitize";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FEEDBACK_KEY = "civia:feedback:messages";
const FEEDBACK_CAP = 500;

const schema = z.object({
  kind: z.enum(["bug", "idea", "question", "other"]).default("other"),
  message: z.string().min(5, "Mesajul e prea scurt").max(2000),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`feedback:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe mesaje. Mai trimite peste o oră." },
      { status: 429 },
    );
  }

  if (!analyticsRedis) {
    return NextResponse.json({ error: "Storage indisponibil" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const entry = {
      t: Date.now(),
      kind: parsed.kind,
      message: sanitizeText(parsed.message, 2000),
      email: parsed.email ?? user?.email ?? null,
      userId: user?.id ?? null,
      ip,
      country: req.headers.get("x-vercel-ip-country") ?? null,
      pathname: req.headers.get("referer") ?? null,
    };

    // LPUSH + LTRIM keeps the most recent FEEDBACK_CAP messages.
    await analyticsRedis.lpush(FEEDBACK_KEY, JSON.stringify(entry));
    await analyticsRedis.ltrim(FEEDBACK_KEY, 0, FEEDBACK_CAP - 1);
    // Also bump a per-kind counter so the dashboard can show bug/idea/
    // question totals at a glance.
    await analyticsRedis.hincrby("civia:feedback:counts", parsed.kind, 1);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Input invalid" },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : "Eroare server";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
// 5/22/2026: scos `export { FEEDBACK_KEY }` — Next 16 nu permite exports
// custom în route handlers (doar GET/POST/dynamic/revalidate etc.). Era
// neutilizat oriunde, deci safe să-l las ca const local.
