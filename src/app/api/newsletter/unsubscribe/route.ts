/**
 * GET/POST /api/newsletter/unsubscribe?e={base64url email}&t={hmac}
 *
 * Dezabonare 1-click (GDPR / RFC 8058), fără login. Token HMAC stateless.
 *
 * 2026-06-05 FIX GDPR: înainte actualiza `newsletter_subscriptions.active`
 * (tabelă neutilizată la trimitere) → digestul continua să plece. Acum setează
 * `newsletter_subscribers.unsubscribed_at` — EXACT tabela din care pleacă
 * digestul + weekly. Dezabonarea chiar oprește emailurile.
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken, decodeUnsubscribeEmail } from "@/lib/email/newsletter-unsubscribe";

export const dynamic = "force-dynamic";

function htmlPage(title: string, message: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="ro"><head><title>${title}</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:24px;text-align:center;"><h1>${title}</h1><p>${message}</p><p style="margin-top:32px;color:#666;font-size:14px;">Dacă te răzgândești, te poți reabona oricând pe <a href="https://www.civia.ro" style="color:#059669;">civia.ro</a>.</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const e = url.searchParams.get("e");
  const t = url.searchParams.get("t");
  if (!e || !t) return htmlPage("Link incomplet", "Lipsește parametrul de dezabonare.", 400);

  const email = decodeUnsubscribeEmail(e);
  if (!email || !verifyUnsubscribeToken(email, t)) {
    return htmlPage("Link invalid", "Link-ul de dezabonare nu este valid sau a expirat.", 403);
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .ilike("email", email)
    .is("unsubscribed_at", null);

  // Idempotent: chiar dacă rândul nu există / era deja dezabonat, confirmăm.
  if (error) {
    return htmlPage("Eroare", "A apărut o eroare. Încearcă din nou sau scrie-ne la contact@civia.ro.", 500);
  }

  return htmlPage("Te-ai dezabonat ✓", "Nu vei mai primi newsletter-ul Civia.", 200);
}

export async function GET(req: Request) {
  return handle(req);
}

// POST pentru List-Unsubscribe=One-Click (RFC 8058).
export async function POST(req: Request) {
  return handle(req);
}
