import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { analyticsRedis } from "@/lib/analytics/redis";
import { sendEmail, emailTemplate } from "@/lib/email/resend";

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
    title: "Confirmă abonarea la Civia",
    kicker: "CIVIA · NEWSLETTER",
    preheader: "Un click și ești pe listă. Fără click, nu te trimitem nimic.",
    body: `
      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#0f172a;">
        Mulțumim! Mai e un singur pas — confirmă că emailul îți aparține, ca să fim siguri că nu te-a abonat altcineva pe șest.
      </p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${confirmUrl}" style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Confirmă abonarea</a>
      </p>
      <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#64748b;">
        Link-ul e valabil 7 zile. Dacă nu confirmi, ștergem cererea automat.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Dacă nu tu ai cerut asta, ignoră acest mesaj — emailul tău nu va fi adăugat nicăieri.
      </p>
    `,
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
