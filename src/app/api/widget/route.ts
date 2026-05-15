import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * GET /api/widget?judet=b&format=json|text
 *
 * Endpoint optimizat pentru widget-uri de home screen (Apple Shortcuts,
 * Tasker pe Android, Glance pe Android 12+). Returnează un snapshot
 * minimal cu statistici de cetățean:
 *  - sesizări active în judet
 *  - sesizări noi în ultimele 24h
 *  - top 3 sesizări recente
 *
 * `format=text` returnează un plain-text scurt potrivit pentru widget,
 * exact ce arătă un Apple Shortcut „Get Contents of URL → Show Result".
 * `format=json` returnează datele structurate pentru widget complex.
 *
 * Public, cache 60s.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const judet = (url.searchParams.get("judet") ?? "").toLowerCase();
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "3", 10) || 3, 10);

  const admin = createSupabaseAdmin();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Query în paralel: count active, count last 24h, top recente
  const activeQuery = admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .not("status", "in", "(rezolvat,respins)");

  const lastDayQuery = admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .gte("created_at", yesterday);

  const recentQuery = admin
    .from("sesizari")
    .select("code, titlu, locatie, sector, status, created_at, county")
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (judet) {
    activeQuery.eq("county", judet);
    lastDayQuery.eq("county", judet);
    recentQuery.eq("county", judet);
  }

  const [activeRes, lastDayRes, recentRes] = await Promise.all([
    activeQuery,
    lastDayQuery,
    recentQuery,
  ]);

  const active = activeRes.count ?? 0;
  const lastDay = lastDayRes.count ?? 0;
  const recent = (recentRes.data ?? []).map((s) => ({
    code: s.code,
    title: s.titlu,
    location: s.locatie,
    sector: s.sector,
    status: s.status,
    age: humanAge(s.created_at),
  }));

  const data = {
    judet: judet || "ro",
    active,
    last24h: lastDay,
    recent,
    updated_at: new Date().toISOString(),
  };

  // PLAIN TEXT format — pentru Apple Shortcut widget cu „Show Result"
  if (format === "text") {
    const lines: string[] = [];
    lines.push(`🏛️ Civia${judet ? ` · ${judet.toUpperCase()}` : ""}`);
    lines.push(`${active} sesizări active · ${lastDay} noi azi`);
    lines.push("");
    for (const r of recent) {
      lines.push(`#${r.code} — ${r.title}`);
      lines.push(`📍 ${r.location} · ${r.age}`);
      lines.push("");
    }
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

function humanAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "acum";
  if (min < 60) return `acum ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `acum ${h}h`;
  const d = Math.floor(h / 24);
  return `acum ${d}z`;
}
