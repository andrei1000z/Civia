import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { routeFromImage } from "@/lib/groq/vision-routing";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  imageUrl: z.string().url(),
});

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
  return NextResponse.json(result);
}
