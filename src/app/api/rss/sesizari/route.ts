import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { safeTitlu } from "@/lib/sesizari/titlu";

export const dynamic = "force-dynamic";

/**
 * GET /api/rss/sesizari — RSS 2.0 feed pentru sesizări publice.
 * Filter optional: ?category=parking sau ?county=B sau ?sector=S5
 *
 * Permite cetățenilor să abone în feed reader (Feedly, NewsBlur) și să
 * primească update-uri auto pe sesizările dintr-o zonă/categorie.
 * (P4.918, P4.919 — Atom alternative pe /api/atom/sesizari)
 */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || url.searchParams.get("tip");
  const county = url.searchParams.get("county");
  const sector = url.searchParams.get("sector");

  const admin = createSupabaseAdmin();
  let query = admin
    .from("sesizari")
    .select("code, titlu, descriere, locatie, county, sector, tip, status, created_at, lat, lng")
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (category) query = query.eq("tip", category);
  if (county) query = query.eq("county", county.toUpperCase());
  if (sector) query = query.eq("sector", sector.toUpperCase());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((s) => {
    const sesizare = s as {
      code: string; titlu: string; descriere: string | null;
      locatie: string | null; county: string | null; sector: string | null;
      tip: string; status: string; created_at: string;
      lat: number | null; lng: number | null;
    };
    const link = `https://civia.ro/sesizari/${sesizare.code}`;
    const pubDate = new Date(sesizare.created_at).toUTCString();
    const description = `${sesizare.descriere ?? ""}\n\nLocație: ${sesizare.locatie}\nTip: ${sesizare.tip}\nStatus: ${sesizare.status}`;
    const geo = sesizare.lat && sesizare.lng
      ? `<geo:lat>${sesizare.lat}</geo:lat><geo:long>${sesizare.lng}</geo:long>`
      : "";
    return `<item>
      <title>${xmlEscape(safeTitlu(sesizare.titlu, { descriere: sesizare.descriere }))}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${xmlEscape(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${xmlEscape(sesizare.tip)}</category>
      ${sesizare.county ? `<category>${xmlEscape(sesizare.county)}</category>` : ""}
      ${geo}
    </item>`;
  });

  const filters: string[] = [];
  if (category) filters.push(`tip=${category}`);
  if (county) filters.push(`județ=${county}`);
  if (sector) filters.push(`sector=${sector}`);
  const filterDesc = filters.length > 0 ? ` (${filters.join(", ")})` : "";

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Sesizări civice România${filterDesc} — Civia</title>
  <link>https://civia.ro/sesizari-publice</link>
  <description>Sesizări depuse de cetățeni prin Civia. Actualizat la fiecare minut.</description>
  <language>ro-RO</language>
  <atom:link href="${url.href}" rel="self" type="application/rss+xml" />
  <generator>Civia.ro RSS Generator</generator>
  ${items.join("\n  ")}
</channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
