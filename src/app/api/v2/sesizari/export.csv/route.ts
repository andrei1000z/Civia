import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v2/sesizari/export.csv — CSV bulk export pentru jurnaliști + cercetători.
 * (P4.916)
 *
 * Filtere: ?county=B&sector=S5&tip=stalpisori&status=rezolvat&since=2026-01-01
 * Max 5000 rows per request (anti-abuse). Pentru date complete, paginare via ?offset=N.
 *
 * Format: standard CSV cu separator virgulă, encoding UTF-8 BOM (Excel-compatible).
 * Privacy: scrubim PII (author_email, author_address). Doar author_display_name (anonim
 * dacă hide_name=true).
 */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Escape: dacă conține virgulă, quote sau newline → wrap cu quotes + escape interior
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const county = url.searchParams.get("county");
  const sector = url.searchParams.get("sector");
  const tip = url.searchParams.get("tip");
  const status = url.searchParams.get("status");
  const since = url.searchParams.get("since"); // ISO date
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10));

  const admin = createSupabaseAdmin();
  let query = admin
    .from("sesizari")
    .select("code, titlu, tip, status, locatie, sector, county, lat, lng, created_at, updated_at, resolved_at, sent_via_civia, sent_at")
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset + 4999);

  if (county) query = query.eq("county", county.toUpperCase());
  if (sector) query = query.eq("sector", sector.toUpperCase());
  if (tip) query = query.eq("tip", tip);
  if (status) query = query.eq("status", status);
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    code: string; titlu: string; tip: string; status: string;
    locatie: string; sector: string | null; county: string | null;
    lat: number | null; lng: number | null;
    created_at: string; updated_at: string; resolved_at: string | null;
    sent_via_civia: boolean; sent_at: string | null;
  }>;

  // CSV header
  const headers = [
    "code", "titlu", "tip", "status", "locatie", "sector", "county",
    "lat", "lng", "created_at", "updated_at", "resolved_at",
    "sent_via_civia", "sent_at", "detail_url",
  ];

  const csvLines: string[] = [headers.join(",")];
  for (const r of rows) {
    csvLines.push([
      csvEscape(r.code),
      csvEscape(r.titlu),
      csvEscape(r.tip),
      csvEscape(r.status),
      csvEscape(r.locatie),
      csvEscape(r.sector),
      csvEscape(r.county),
      csvEscape(r.lat),
      csvEscape(r.lng),
      csvEscape(r.created_at),
      csvEscape(r.updated_at),
      csvEscape(r.resolved_at),
      csvEscape(r.sent_via_civia ? "yes" : "no"),
      csvEscape(r.sent_at),
      csvEscape(`https://civia.ro/sesizari/${r.code}`),
    ].join(","));
  }

  // UTF-8 BOM ca Excel să recunoască corect diacritice
  const bom = "﻿";
  const csv = bom + csvLines.join("\r\n");

  const filename = `civia-sesizari-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      "Access-Control-Allow-Origin": "*",
      "X-Total-Rows": String(rows.length),
      "X-Privacy": "PII-scrubbed (no email, address, phone)",
    },
  });
}
