import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { routeFromImage } from "@/lib/groq/vision-routing";
import { analyticsRedis, KEY } from "@/lib/analytics/redis";
import { checkAndIncrementQuota } from "@/lib/ai/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  imageUrl: z.string().url(),
});

function confidenceBucket(c: number): string {
  if (c < 26) return "0-25";
  if (c < 51) return "26-50";
  if (c < 76) return "51-75";
  return "76-100";
}

/**
 * POST /api/ai/vision-route { imageUrl }
 *
 * Trimite poza la Groq Llama 4 Scout pentru detectie tip + autoritate
 * competenta. Folosit in formularul de sesizare ca sa pre-completeze
 * automat tip-ul si sa sugereze autoritatea inainte ca userul sa apese
 * Trimite.
 *
 * Rate-limit: 30/h per IP (tier free abuses).
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`vision-route:${ip}`, { limit: 30, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe analize. Asteapta o ora." }, { status: 429 });
  }

  // Batch 5 (5/22/2026) — quota check (plan item #74).
  // Vision e cel mai costisitor AI call (Groq 17B + image). Strict limit.
  const quota = await checkAndIncrementQuota({ identifier: ip, feature: "vision" });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason ?? "Quota AI vision atinsa" },
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const result = await routeFromImage(parsed.data.imageUrl);

  // Server-side telemetry: vedem confidence-distribution + tip-uri returnate,
  // independent de ce face client-ul (accepta/override). Fire-and-forget,
  // nu blocam raspunsul.
  if (analyticsRedis) {
    try {
      const bucket = result.fallback ? "fallback" : confidenceBucket(result.confidence);
      const pipe = analyticsRedis.pipeline();
      pipe.hincrby(KEY.visionConfidence, bucket, 1);
      pipe.hincrby(KEY.visionTips, result.tip || "altele", 1);
      pipe.hincrby(KEY.visionAuthorities, result.authority || "necunoscut", 1);
      await pipe.exec();
    } catch { /* never block response on telemetry */ }
  }

  return NextResponse.json(result);
}
