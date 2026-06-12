import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  sendEmail,
  emailTemplate,
  emailGreeting,
  emailSectionTitle,
  emailStatCards,
  emailListCard,
} from "@/lib/email/resend";
import { buildSalutation } from "@/lib/email/format";
import { newsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";
import { getUpcomingEvents } from "@/data/calendar-civic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly newsletter digest. Runs via Vercel Cron (see vercel.json).
 *
 * Pulls:
 *   - Top 5 sesizari nou rezolvate în ultima săptămână
 *   - Stats diff față de săptămâna trecută (total, rezolvate)
 *   - Următoarele 3 evenimente din calendar-civic
 * Then sends to every confirmed subscriber in the newsletter_subscribers table.
 *
 * Protected by CRON_SECRET header. Vercel Cron automatically sends this header.
 */
export async function GET(req: Request) {
  // Auth via Vercel Cron secret
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const twoWeeksAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();

  // Fetch digest data
  const [thisWeekTotal, lastWeekTotal, thisWeekResolved, lastWeekResolved, topResolvedRes, subsRes] =
    await Promise.all([
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .gte("created_at", weekAgoIso),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .gte("created_at", twoWeeksAgoIso)
        .lt("created_at", weekAgoIso),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .eq("status", "rezolvat")
        .gte("resolved_at", weekAgoIso),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "approved")
        .eq("status", "rezolvat")
        .gte("resolved_at", twoWeeksAgoIso)
        .lt("resolved_at", weekAgoIso),
      admin
        .from("sesizari")
        .select("code, titlu, locatie, tip, resolved_at")
        .eq("moderation_status", "approved")
        .eq("status", "rezolvat")
        .gte("resolved_at", weekAgoIso)
        .order("resolved_at", { ascending: false })
        .limit(5),
      admin
        .from("newsletter_subscribers")
        .select("email")
        .is("unsubscribed_at", null)
        .not("confirmed_at", "is", null),
    ]);

  const weekTotal = thisWeekTotal.count ?? 0;
  const prevTotal = lastWeekTotal.count ?? 0;
  const weekResolved = thisWeekResolved.count ?? 0;
  const prevResolved = lastWeekResolved.count ?? 0;
  const subscribers = (subsRes.data ?? []) as { email: string }[];

  if (subscribers.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      reason: "No confirmed subscribers",
      stats: { weekTotal, weekResolved },
    });
  }

  const topResolved = (topResolvedRes.data ?? []) as Array<{
    code: string;
    titlu: string;
    locatie: string;
    tip: string;
    resolved_at: string;
  }>;

  const upcomingEvents = getUpcomingEvents(3);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

  /** Delta % față de săptămâna trecută — copy curat, fără „+∞%". */
  function deltaLabel(curr: number, prev: number): string {
    if (prev === 0) return curr > 0 ? "în creștere" : "la fel ca săpt. trecută";
    const diff = ((curr - prev) / prev) * 100;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(0)}% vs săpt. trecută`;
  }

  function deltaTone(curr: number, prev: number): "up" | "down" | "flat" {
    if (curr === prev) return "flat";
    return curr > prev ? "up" : "down";
  }

  /** Numeral românesc corect: „1 sesizare nouă", „5 sesizări noi", „20 de sesizări noi". */
  function roCount(n: number, singular: string, plural: string): string {
    if (n === 1) return `1 ${singular}`;
    const rem = n % 100;
    const needsDe = n >= 20 && !(rem >= 1 && rem <= 19);
    return `${n}${needsDe ? " de" : ""} ${plural}`;
  }

  const noiTxt = roCount(weekTotal, "sesizare nouă", "sesizări noi");
  const rezTxt = roCount(weekResolved, "rezolvată", "rezolvate");

  const body = `
    ${emailGreeting(
      buildSalutation({}),
      "Bilanțul ultimelor 7 zile pe Civia: ce au raportat cetățenii și ce au obținut.",
    )}

    ${emailStatCards([
      {
        value: String(weekTotal),
        label: "Sesizări noi",
        delta: deltaLabel(weekTotal, prevTotal),
        deltaTone: deltaTone(weekTotal, prevTotal),
      },
      {
        value: String(weekResolved),
        label: "Rezolvate",
        delta: deltaLabel(weekResolved, prevResolved),
        deltaTone: deltaTone(weekResolved, prevResolved),
      },
    ])}

    ${
      topResolved.length > 0
        ? `${emailSectionTitle("Rezolvate săptămâna asta")}
    ${emailListCard(
      topResolved.map((s) => ({
        title: s.titlu,
        meta: s.locatie,
        url: `${siteUrl}/sesizari/${s.code}`,
        badge: "REZOLVAT",
        badgeColor: "#059669",
      })),
    )}`
        : ""
    }

    ${
      upcomingEvents.length > 0
        ? `${emailSectionTitle("Urmează în calendarul civic")}
    ${emailListCard(
      upcomingEvents.map((e) => ({
        title: e.title,
        meta: new Date(e.date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" }),
        ...(e.url ? { url: e.url } : {}),
      })),
    )}`
        : ""
    }
  `;

  // Send to all subscribers (sequential with tiny gap — Resend rate limit ~10/s free tier)
  // 2026-06-05 — html construit PER destinatar ca să includem link-ul de
  // dezabonare individual (GDPR one-click) + header List-Unsubscribe.
  // audit fix: înainte serial cu sleep 120ms/email (lent pe liste mari). Acum
  // loturi PARALELE (Promise.allSettled) — latențele de send se suprapun → mult
  // mai rapid wall-clock, cu un gap între loturi ca să rămânem sub ~10/s (free tier).
  const subject = `Săptămâna civică — ${noiTxt}, ${rezTxt}`;
  const sendOne = async (sub: { email: string }): Promise<boolean> => {
    const unsubUrl = newsletterUnsubscribeUrl(sub.email, siteUrl);
    const html = emailTemplate({
      title: `${noiTxt}, ${rezTxt}`,
      kicker: "SĂPTĂMÂNA CIVICĂ",
      icon: "🗞️",
      preheader: `Bilanțul săptămânii pe Civia: top rezolvări și ce urmează în calendarul civic.`,
      body: `${body}<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#86868b;text-align:center">Primești acest email pentru că ești abonat la newsletter-ul Civia. <a href="${unsubUrl}" style="color:#86868b;text-decoration:underline">Dezabonează-te</a>.</p>`,
      ctaText: "Vezi sesizările publice",
      ctaUrl: `${siteUrl}/sesizari-publice`,
    });
    const result = await sendEmail({ to: sub.email, subject, html, listUnsubscribe: unsubUrl });
    return result.ok;
  };

  let sent = 0;
  let failed = 0;
  const CHUNK = 8;
  for (let i = 0; i < subscribers.length; i += CHUNK) {
    const group = subscribers.slice(i, i + CHUNK);
    const results = await Promise.allSettled(group.map(sendOne));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else failed++;
    }
    if (i + CHUNK < subscribers.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    subscribers: subscribers.length,
    stats: { weekTotal, weekResolved, prevTotal, prevResolved },
    generatedAt: nowIso,
  });
}
