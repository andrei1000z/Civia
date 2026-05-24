import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/ical/proteste — iCal feed pentru toate protestele publice.
 *
 * Permite cetățenilor să subscribe în Google Calendar / Apple Calendar /
 * Outlook și primesc auto-update când apare un protest nou. (P4.920)
 *
 * Spec: RFC 5545 (iCalendar)
 */

function icalEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function formatICalDate(iso: string): string {
  // YYYYMMDDTHHmmssZ format pentru UTC
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace(/Z?$/, "Z");
}

export async function GET() {
  const admin = createSupabaseAdmin();
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60_000).toISOString();
  const { data: proteste } = await admin
    .from("proteste")
    .select("slug, title, summary, location_text, date_start, date_end, updated_at")
    .eq("visibility", "publica")
    .gte("date_start", sixMonthsAgo)
    .order("date_start", { ascending: true })
    .limit(200);

  const now = formatICalDate(new Date().toISOString());

  const events = (proteste ?? []).map((p) => {
    const protest = p as {
      slug: string;
      title: string;
      summary: string | null;
      location_text: string | null;
      date_start: string;
      date_end: string | null;
      updated_at: string;
    };
    const start = formatICalDate(protest.date_start);
    const end = formatICalDate(protest.date_end ?? protest.date_start);
    const url = `https://civia.ro/proteste/${protest.slug}`;
    return [
      "BEGIN:VEVENT",
      `UID:${protest.slug}@civia.ro`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `LAST-MODIFIED:${formatICalDate(protest.updated_at)}`,
      `SUMMARY:${icalEscape(protest.title)}`,
      `DESCRIPTION:${icalEscape((protest.summary ?? "") + "\n\nDetalii: " + url)}`,
      `URL:${url}`,
      `LOCATION:${icalEscape(protest.location_text ?? "România")}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ].join("\r\n");
  });

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Civia.ro//Proteste//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Proteste civice România — Civia",
    "X-WR-CALDESC:Proteste publice aggregate de Civia.ro",
    "X-WR-TIMEZONE:Europe/Bucharest",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=\"civia-proteste.ics\"",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
