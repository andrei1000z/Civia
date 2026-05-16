import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { getUpcomingEvents } from "@/data/calendar-civic";
import { SESIZARE_TIPURI } from "@/lib/constants";

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

  function tipIcon(tip: string): string {
    return SESIZARE_TIPURI.find((t) => t.value === tip)?.icon ?? "📮";
  }

  function pctChange(curr: number, prev: number): string {
    if (prev === 0) return curr > 0 ? "+∞%" : "±0%";
    const diff = ((curr - prev) / prev) * 100;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(0)}%`;
  }

  const body = `
    <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a">Săptămâna civică</h2>
    <p style="color:#64748b;margin:0 0 20px">Iată cum au contribuit cetățenii în ultimele 7 zile.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      <tr>
        <td style="background:#f1f5f9;border-radius:8px;padding:16px;width:48%;vertical-align:top">
          <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Sesizări noi</div>
          <div style="font-size:28px;font-weight:800;color:#1C4ED8">${weekTotal}</div>
          <div style="color:#64748b;font-size:12px;margin-top:4px">${pctChange(weekTotal, prevTotal)} vs săpt. trecută</div>
        </td>
        <td width="16"></td>
        <td style="background:#ecfdf5;border-radius:8px;padding:16px;width:48%;vertical-align:top">
          <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Rezolvate</div>
          <div style="font-size:28px;font-weight:800;color:#059669">${weekResolved}</div>
          <div style="color:#64748b;font-size:12px;margin-top:4px">${pctChange(weekResolved, prevResolved)} vs săpt. trecută</div>
        </td>
      </tr>
    </table>

    ${topResolved.length > 0 ? `
    <h3 style="font-size:16px;margin:24px 0 12px;color:#0f172a">🎉 Rezolvate săptămâna asta</h3>
    <ul style="margin:0 0 24px;padding-left:0;list-style:none">
      ${topResolved
        .map(
          (s) => `
        <li style="padding:12px 0;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:600;color:#0f172a;font-size:14px">${tipIcon(s.tip)} ${escapeHtml(s.titlu)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:2px">📍 ${escapeHtml(s.locatie)}</div>
          <a href="${siteUrl}/sesizari/${s.code}" style="color:#1C4ED8;font-size:12px;text-decoration:none">Vezi sesizarea →</a>
        </li>`
        )
        .join("")}
    </ul>
    ` : ""}

    ${upcomingEvents.length > 0 ? `
    <h3 style="font-size:16px;margin:24px 0 12px;color:#0f172a">📅 Urmează</h3>
    <ul style="margin:0 0 24px;padding-left:0;list-style:none">
      ${upcomingEvents
        .map(
          (e) => `
        <li style="padding:12px 0;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:600;color:#0f172a;font-size:14px">${escapeHtml(e.title)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:2px">${new Date(e.date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}</div>
        </li>`
        )
        .join("")}
    </ul>
    ` : ""}

    <p style="color:#64748b;font-size:12px;margin-top:24px">
      Primești acest email pentru că te-ai abonat la Civia. Nu mai vrei?
      <a href="${siteUrl}/legal/confidentialitate" style="color:#1C4ED8">gestionează preferințele</a>.
    </p>
  `;

  const html = emailTemplate({
    title: "Săptămâna civică",
    preheader: `${weekTotal} sesizări noi, ${weekResolved} rezolvate săptămâna asta pe Civia`,
    body,
    ctaText: "Vezi sesizările publice",
    ctaUrl: `${siteUrl}/sesizari-publice`,
  });

  // Send to all subscribers (sequential with tiny gap — Resend rate limit ~10/s free tier)
  let sent = 0;
  let failed = 0;
  for (const sub of subscribers) {
    const ok = await sendEmail({
      to: sub.email,
      subject: `Civia — ${weekTotal} sesizări noi, ${weekResolved} rezolvate săptămâna asta`,
      html,
    });
    if (ok) sent++;
    else failed++;
    // Throttle: ~10 emails/sec upper bound
    await new Promise((r) => setTimeout(r, 120));
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
