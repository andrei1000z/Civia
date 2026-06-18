import { NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { analyticsRedis } from "@/lib/analytics/redis";
import { sendEmail, emailTemplate, emailGreeting, emailSectionTitle, emailListCard } from "@/lib/email/resend";
import { buildSalutation } from "@/lib/email/format";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

function htmlResponse(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} — Civia</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background: #f8fafc; color: #0f172a; }
    .wrap { max-width: 520px; margin: 80px auto; padding: 32px 24px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center; }
    h1 { margin: 0 0 12px 0; font-size: 22px; font-weight: 700; }
    p { margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #475569; }
    a.btn { display: inline-block; margin-top: 16px; background: #059669; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length < 16) {
    return htmlResponse(
      "Link invalid",
      `<h1>Link invalid</h1><p>Link-ul de confirmare e gol sau corupt. Verifică emailul primit, sau abonează-te din nou.</p><a class="btn" href="${SITE_URL}/">Înapoi la Civia</a>`,
      400,
    );
  }

  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("newsletter_subscribers")
    .select("id, email, confirmed_at, confirm_sent_at")
    .eq("confirm_token", token)
    .maybeSingle();

  if (!existing) {
    return htmlResponse(
      "Link expirat sau folosit",
      `<h1>Link invalid</h1><p>Acest link de confirmare nu există sau a fost deja folosit. Dacă ești deja abonat, ești ok.</p><a class="btn" href="${SITE_URL}/">Înapoi la Civia</a>`,
      404,
    );
  }

  // 7-day expiry pe link.
  if (existing.confirm_sent_at) {
    const sent = new Date(existing.confirm_sent_at).getTime();
    if (Date.now() - sent > 7 * 24 * 60 * 60 * 1000) {
      return htmlResponse(
        "Link expirat",
        `<h1>Link expirat</h1><p>Link-ul a expirat (validitate 7 zile). Abonează-te din nou ca să primești unul proaspăt.</p><a class="btn" href="${SITE_URL}/">Înapoi la Civia</a>`,
        410,
      );
    }
  }

  if (existing.confirmed_at) {
    return htmlResponse(
      "Deja confirmat",
      `<h1>Ești deja abonat ✓</h1><p>Mulțumim! Emailul tău e deja pe lista Civia.</p><a class="btn" href="${SITE_URL}/">Înapoi la Civia</a>`,
    );
  }

  // 2026-05-24 BUG FIX: înainte se updata DOAR `confirmed_at` (timestamp) dar
  // NU și `confirmed` (boolean) → newsletter weekly digest filtra pe
  // `.eq("confirmed", true)` și găsea 0 subscribers (DB dump: 9 înscriși,
  // 0 confirmed). Acum actualizăm AMBELE coloane atomic.
  const { error } = await admin
    .from("newsletter_subscribers")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      confirm_token: null,
    })
    .eq("id", existing.id);

  if (error) {
    // Bug fix 5/22/2026 — silent failure inainte: user vedea „Eroare" dar
    // admin n-avea cum sa stie de ce. Acum Sentry capture cu context.
    Sentry.captureException(error, {
      tags: { kind: "newsletter_confirm_failed" },
      extra: { subscriberId: existing.id },
    });
    return htmlResponse(
      "Eroare",
      `<h1>Eroare</h1><p>Nu am putut confirma chiar acum. Încearcă din nou peste câteva minute.</p>`,
      500,
    );
  }

  if (analyticsRedis) {
    try {
      await analyticsRedis.hincrby("civia:newsletter:counts", "confirmed", 1);
    } catch {
      // ignore
    }
  }

  // 2026-06-06 (audit #7) — email de onboarding la confirmare. Înainte: userul
  // confirma și nu mai primea nimic până la primul digest (puteau trece zile)
  // → moment de „și acum ce?". Welcome imediat: ce e Civia + ce poate face.
  // Non-blocking via after() ca să nu întârzie pagina de confirmare.
  after(async () => {
    try {
      const html = emailTemplate({
        title: "Bine ai venit pe Civia",
        preheader: "Abonarea e confirmată. Iată ce poți face chiar acum.",
        kicker: "BINE AI VENIT",
        icon: "👋",
        body: `
          ${emailGreeting(
            buildSalutation({ email: existing.email }),
            "Abonarea ta e confirmată. De acum primești vești când lucrurile se mișcă — sesizări rezolvate, petiții noi, progres real.",
          )}
          <p style="margin:0 0 4px;font-size:15px;line-height:1.7">Civia e platforma civică independentă a României. Aici nu doar te informezi — <strong>acționezi</strong>.</p>
          ${emailSectionTitle("Ce poți face chiar acum")}
          ${emailListCard([
            {
              title: "Fă o sesizare",
              meta: "O groapă, gunoi, o parcare ilegală? AI-ul o formulează oficial și o trimite autorității potrivite, conform OG 27/2002.",
              url: `${SITE_URL}/sesizari`,
            },
            {
              title: "Semnează o petiție",
              meta: "Cauze civice reale, atent selectate, cu impact.",
              url: `${SITE_URL}/petitii`,
            },
          ])}
          <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#86868b">Fără spam. Te poți dezabona oricând, dintr-un click.</p>
        `,
        ctaText: "Fă o sesizare",
        ctaUrl: `${SITE_URL}/sesizari`,
      });
      await sendEmail({
        to: existing.email,
        subject: "Bine ai venit pe Civia 👋",
        html,
      });
    } catch (e) {
      Sentry.captureException(e, { tags: { kind: "newsletter_welcome_failed" }, extra: { subscriberId: existing.id } });
    }
  });

  return htmlResponse(
    "Confirmat",
    `<h1>Bine ai venit pe Civia ✓</h1><p>Abonarea a fost confirmată. O să primești update-uri când lucrurile se mișcă pe platformă.</p><a class="btn" href="${SITE_URL}/">Înapoi la Civia</a>`,
  );
}
