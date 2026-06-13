import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  sendEmail,
  emailTemplate,
  emailGreeting,
  emailSectionTitle,
  emailStatCards,
  emailListCard,
  emailNoteCallout,
  emailPhotoBlock,
} from "@/lib/email/resend";
import { buildSalutation } from "@/lib/email/format";
import { newsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";

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
  const isCron = verifyBearer(auth, cronSecret);
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

  const nRezolvate = rezolvate.length;
  const nNoi = totalSesizariWeek ?? 0;

  // Lista „inset grouped" (stil iOS) — top 5 rezolvate, cu badge verde.
  const listHtml = emailListCard(
    rezolvate.map((s) => ({
      title: s.titlu,
      meta: [s.locatie, `rezolvată ${formatRelative(s.resolved_at)}`].filter(Boolean).join(" · "),
      url: `${SITE_URL}/sesizari/${s.code}`,
      badge: "REZOLVAT",
      badgeColor: "#059669",
    })),
  );

  // Prima poză a primei sesizări rezolvate — dovada vizuală că platforma livrează.
  const firstImage = (rezolvate[0]?.imagini as string[] | null | undefined)?.filter(Boolean)?.[0];
  const photoHtml = firstImage
    ? emailPhotoBlock({ images: [firstImage], label: "Una dintre problemele rezolvate" })
    : "";

  const statsHtml = emailStatCards([
    { value: String(nRezolvate), label: nRezolvate === 1 ? "problemă rezolvată" : "probleme rezolvate" },
    { value: String(nNoi), label: nNoi === 1 ? "sesizare nouă" : "sesizări noi" },
  ]);

  let sent = 0;
  let failed = 0;
  const subject =
    nRezolvate === 1
      ? "🎉 O problemă rezolvată săptămâna asta"
      : `🎉 ${nRezolvate} probleme rezolvate săptămâna asta`;

  for (const r of recipients as Array<{ email: string }>) {
    if (!r.email) continue;
    const unsubUrl = newsletterUnsubscribeUrl(r.email, SITE_URL);
    try {
      await sendEmail({
        to: r.email,
        subject,
        listUnsubscribe: unsubUrl,
        html: emailTemplate({
          title: "Săptămâna asta s-a reparat ceva",
          kicker: "DIGESTUL DE VINERI",
          icon: "🎉",
          accent: "#059669",
          preheader: `${nRezolvate} probleme reparate și ${nNoi} sesizări noi. Vezi ce s-a rezolvat.`,
          body: `
            ${emailGreeting(
              buildSalutation({ email: r.email }),
              "Vinerea tragem linie: ce au reparat autoritățile în urma sesizărilor trimise prin Civia.",
            )}
            ${statsHtml}
            ${photoHtml}
            ${emailSectionTitle("Rezolvate săptămâna asta")}
            ${listHtml}
            ${emailNoteCallout({
              label: "Cum funcționează",
              text: "Fiecare sesizare ajunge oficial la autoritatea responsabilă, în baza OG 27/2002. Când vine răspunsul, statusul se actualizează public.",
              tone: "muted",
            })}
            <p style="margin:18px 0 0;font-size:12px;color:#a1a1a6;line-height:1.6">
              Primești acest email pentru că ești abonat la newsletterul Civia.
              <a href="${unsubUrl}" style="color:#a1a1a6">Dezabonează-te</a>.
            </p>
          `,
          ctaText: "Vezi sesizările rezolvate",
          ctaUrl: `${SITE_URL}/sesizari-rezolvate`,
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
