import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { analyticsRedis } from "@/lib/analytics/redis";
import { sendEmail, emailTemplate, emailNoteCallout } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

// 5/22/2026: scos `export` — Next 16 nu permite exports custom în route handlers.
const NEWSLETTER_REDIS_KEY = "civia:newsletter:subscribers";
const NEWSLETTER_REDIS_CAP = 1000;

const schema = z.object({
  email: z.string().email("Email invalid"),
  sectors: z.array(z.enum(["S1", "S2", "S3", "S4", "S5", "S6"])).optional(),
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

function buildConfirmEmail(confirmUrl: string): string {
  return emailTemplate({
    title: "Confirmă abonarea",
    kicker: "UN SINGUR PAS",
    icon: "✉️",
    accent: "#7C3AED",
    preheader: "Un click și ești pe listă. Fără confirmare, nu îți trimitem nimic.",
    body: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7">Primești acest email pentru că cineva — sperăm că tu — a cerut abonarea acestei adrese la newsletterul Civia.</p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.7">Confirmă cu un click că adresa îți aparține. Așa ne asigurăm că nu te-a abonat altcineva în locul tău.</p>
      ${emailNoteCallout({
        label: "Bine de știut",
        text: "Linkul e valabil 7 zile — dacă nu confirmi, ștergem cererea automat. Nu tu ai cerut abonarea? Ignoră acest mesaj: adresa ta nu va fi adăugată nicăieri.",
        tone: "muted",
      })}
    `,
    ctaText: "Confirmă abonarea",
    ctaUrl: confirmUrl,
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`newsletter:${ip}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe încercări. Așteaptă o oră." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, sectors } = schema.parse(body);

    const admin = createSupabaseAdmin();
    const confirmToken = crypto.randomUUID();

    // Upsert as PENDING — confirmed_at rămâne NULL pana la click.
    const { error } = await admin
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          sectors: sectors ?? [],
          confirm_token: confirmToken,
          confirm_sent_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trimite email de confirmare. Dacă send fail (Resend ratelimit, domain
    // not verified pentru target email), nu blocam — userul poate primi
    // confirmation prin alta cale + admin vede status în dashboard.
    const confirmUrl = `${SITE_URL}/api/newsletter/confirm?token=${confirmToken}`;
    try {
      await sendEmail({
        to: email,
        subject: "Confirmă abonarea la Civia",
        html: buildConfirmEmail(confirmUrl),
      });
    } catch {
      // Silent — Resend free tier rejects unverified targets, dar
      // creem totusi randul DB pentru moment cand domeniul e verified.
    }

    // Mirror into Redis so /admin/analytics shows pending subscribers without
    // an extra DB round-trip. Capped to the most-recent NEWSLETTER_REDIS_CAP.
    if (analyticsRedis) {
      try {
        const entry = JSON.stringify({
          t: Date.now(),
          email,
          sectors: sectors ?? [],
          country: req.headers.get("x-vercel-ip-country") ?? null,
          confirmed: false,
        });
        await analyticsRedis.lpush(NEWSLETTER_REDIS_KEY, entry);
        await analyticsRedis.ltrim(NEWSLETTER_REDIS_KEY, 0, NEWSLETTER_REDIS_CAP - 1);
        await analyticsRedis.hincrby("civia:newsletter:counts", "pending", 1);
      } catch {
        // Redis failure shouldn't block the subscription — DB write succeeded
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Ti-am trimis un email de confirmare. Verifica si Spam.",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
