/**
 * POST /api/newsletter/subscribe
 *
 * 🎁 MEDIUM #8 — Newsletter săptămânal personalizat.
 *
 * Body: { email, county?, topics?[] }
 * Creează subscription cu unsubscribe_token unic.
 * Trimite email confirmare via Resend cu link „Confirmă abonarea".
 *
 * Rate limit: 5/h/IP.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  county: z.string().max(3).optional(),
  topics: z.array(z.string().max(40)).max(8).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`newsletter-sub:${ip}`, { limit: 5, windowMs: 3600_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe încercări" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const { email, county, topics } = parsed.data;
  const token = randomBytes(24).toString("hex");

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("newsletter_subscriptions").upsert(
    {
      email: email.toLowerCase().trim(),
      county: county ?? null,
      topics: topics ?? [],
      unsubscribe_token: token,
      active: true,
    },
    { onConflict: "email" },
  );

  if (error) {
    return NextResponse.json({ error: "Eroare la abonare" }, { status: 500 });
  }

  // Trimite email confirmare
  await sendEmail({
    to: email,
    from: "Civia <newsletter@civia.ro>",
    subject: "Bine ai venit la newsletter-ul Civia 📬",
    html: `
      <p>Bună ziua,</p>
      <p>Te-ai abonat la newsletter-ul săptămânal Civia.ro pentru județul ${county ?? "național"}.</p>
      <p>Vei primi în fiecare luni dimineață:</p>
      <ul>
        <li>Top 5 sesizări de votat</li>
        <li>3 știri civice relevante</li>
        <li>1 petiție de semnat</li>
        <li>1 eveniment civic important</li>
      </ul>
      <p style="margin-top: 24px; font-size: 12px; color: #666;">
        Te poți dezabona oricând:
        <a href="${SITE_URL}/api/newsletter/unsubscribe?token=${token}">Dezabonare</a>
      </p>
    `,
    text: `Bine ai venit la newsletter-ul Civia.\n\nDezabonare: ${SITE_URL}/api/newsletter/unsubscribe?token=${token}`,
  });

  return NextResponse.json({ ok: true });
}
