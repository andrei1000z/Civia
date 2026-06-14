/**
 * GET /api/calendar/export.ics
 *
 * 🎁 MEDIUM #3 — Calendar iCal export pentru Google Calendar / Outlook.
 *
 * Returnează evenimentele civice viitoare ca format iCalendar (.ics).
 * User poate adăuga URL-ul în Google Calendar → "Add by URL".
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface EvenimentRaw {
  date: string;
  category: string;
  title: string;
  location: string | null;
  source_url: string | null;
}

export async function GET() {
  const admin = createSupabaseAdmin();
  const events: EvenimentRaw[] = [];

  // Proteste
  const { data: proteste } = await admin
    .from("proteste")
    .select("data, titlu, oras, source_url")
    .gte("data", new Date().toISOString().slice(0, 10))
    .lte("data", new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10));
  for (const p of (proteste ?? []) as Array<{ data: string; titlu: string; oras: string | null; source_url: string | null }>) {
    events.push({ date: p.data, category: "Protest", title: p.titlu, location: p.oras, source_url: p.source_url });
  }

  // Consultatii publice
  try {
    const { data: cons } = await admin
      .from("consultatii_publice")
      .select("date_sedinta, titlu, consiliu, source_url")
      .gte("date_sedinta", new Date().toISOString().slice(0, 10));
    for (const c of (cons ?? []) as Array<{ date_sedinta: string | null; titlu: string; consiliu: string; source_url: string | null }>) {
      if (!c.date_sedinta) continue;
      events.push({ date: c.date_sedinta, category: "Consultare publică", title: c.titlu, location: c.consiliu, source_url: c.source_url });
    }
  } catch {
    /* table can be missing */
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Civia.ro//Calendar civic//RO",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Calendar Civic Civia.ro",
    "X-WR-TIMEZONE:Europe/Bucharest",
  ];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev) continue;
    const baseDate = new Date(ev.date);
    // Sari peste date malformate din DB — `new Date(NaN).toISOString()` ar
    // arunca „Invalid time value" și ar rupe TOT feed-ul ICS (un rând stricat
    // pică toată descărcarea).
    if (Number.isNaN(baseDate.getTime())) continue;
    const dt = ev.date.replace(/-/g, "");
    const dtEnd = new Date(baseDate.getTime() + 86400_000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const uid = `civia-${dt}-${i}@civia.ro`;
    const stampStr = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] ?? "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stampStr}Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:[${ev.category}] ${escapeIcs(ev.title)}`,
      ev.location ? `LOCATION:${escapeIcs(ev.location)}` : "",
      ev.source_url ? `URL:${ev.source_url}` : "",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.filter(Boolean).join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "Content-Disposition": 'attachment; filename="civia-calendar.ics"',
    },
  });
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
