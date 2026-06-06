import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { newsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";
import { escapeHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

/**
 * GET /api/newsletter/weekly-rezolvate — cron care trimite digest săptămânal
 * vinerea cu top sesizări rezolvate săptămâna asta.
 *
 * Re-engagement masiv: oamenii văd că platforma chiar funcționează → mai
 * activi. Format inspirat 311 NYC weekly digest.
 *
 * Recipients: profilul cu newsletter_opt_in = true și email confirmat.
 * Cron rulează zilnic dar endpoint-ul returnează 202 dacă nu e vineri.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Doar vinerea (sau forced via ?force=true)
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  const today = new Date();
  const isFriday = today.getUTCDay() === 5;
  if (!isFriday && !force) {
    return NextResponse.json({ ok: true, skipped: "not_friday" }, { status: 202 });
  }

  const admin = createSupabaseAdmin();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

  // Top 5 sesizări rezolvate săptămâna asta cu poze
  const { data: rezolvate } = await admin
    .from("sesizari")
    .select("code, titlu, locatie, county, sector, tip, resolved_at, imagini")
    .eq("moderation_status", "approved")
    .eq("status", "rezolvat")
    .gte("resolved_at", weekAgo)
    .order("resolved_at", { ascending: false })
    .limit(5);

  if (!rezolvate || rezolvate.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no_resolved_this_week" });
  }

  // Statistici context
  const { count: totalSesizariWeek } = await admin
    .from("sesizari")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "approved")
    .gte("created_at", weekAgo);

  // Recipienti — newsletter_subscribers confirmați ȘI NEdezabonați.
  // 2026-06-05 FIX GDPR: înainte filtra doar `confirmed=true` și NU excludea
  // `unsubscribed_at` → trimitea către cei dezabonați. Acum identic cu digestul.
  const { data: recipients } = await admin
    .from("newsletter_subscribers")
    .select("email")
    .not("confirmed_at", "is", null)
    .is("unsubscribed_at", null)
    .not("email", "is", null);

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ ok: true, recipients: 0, skipped: "no_subscribers" });
  }

  const itemsHtml = rezolvate.map((s) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
      <p style="font-size:13px;font-weight:600;color:#0f172a;margin:0 0 4px">
        <a href="${SITE_URL}/sesizari/${s.code}" style="color:#059669;text-decoration:none">${escapeHtml(s.titlu)}</a>
      </p>
      <p style="font-size:12px;color:#64748b;margin:0">${escapeHtml(s.locatie ?? "")}</p>
      <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">✓ Rezolvat ${formatRelative(s.resolved_at)}</p>
    </td></tr>
  `).join("");

  let sent = 0;
  let failed = 0;
  const subject = `🎉 ${rezolvate.length} sesizări rezolvate săptămâna asta`;

  for (const r of recipients as Array<{ email: string }>) {
    if (!r.email) continue;
    const unsubUrl = newsletterUnsubscribeUrl(r.email, SITE_URL);
    try {
      await sendEmail({
        to: r.email,
        subject,
        listUnsubscribe: unsubUrl,
        html: emailTemplate({
          title: "Săptămâna în Civia",
          kicker: "Rezolvate săptămâna asta",
          icon: "✅",
          preheader: `${rezolvate.length} probleme reparate, ${totalSesizariWeek ?? 0} sesizări noi. Vezi detaliile.`,
          body: `
            <p>Salut,</p>
            <p>Iată ce s-a rezolvat săptămâna asta în comunitatea Civia:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
              ${itemsHtml}
            </table>
            <p style="margin-top:20px;color:#64748b;font-size:13px">
              Plus ${totalSesizariWeek ?? 0} sesizări noi depuse săptămâna asta.
              <a href="${SITE_URL}/impact" style="color:#059669">Vezi toate cifrele →</a>
            </p>
            <p style="margin-top:24px;font-size:12px;color:#94a3b8">
              Primești acest email pentru că ești abonat la newsletter-ul Civia.
              <a href="${unsubUrl}" style="color:#94a3b8">Dezabonează-te</a>.
            </p>
          `,
          ctaText: "Vezi impactul săptămânal",
          ctaUrl: `${SITE_URL}/impact`,
        }),
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, recipients: recipients.length, sent, failed, resolved_count: rezolvate.length });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60_000));
  if (days === 0) return "azi";
  if (days === 1) return "ieri";
  return `acum ${days} zile`;
}
