import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = await rateLimitAsync(`top-voted:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea rapid" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);
  try {
    const supabase = await createSupabaseServer();
    // Homepage widget only renders id/code/titlu/tip/status/sector/
    // locatie/voturi_net/nr_comentarii. Skipping formal_text +
    // descriere + imagini cuts the payload from ~3 KB/row to
    // ~300 B/row — the widget pulls 5 rows so we save ~14 KB per
    // homepage hit, on top of the already-aggressive 5 min CDN
    // cache below.
    // 2026-05-29 — Status enum extins (trimis, inregistrata, redirectionata,
    // actiune-autoritate, interventie, amanata). Inainte filtra doar
    // "nou"+"in-lucru" → toate cele 53 sesizari aveau status nou (inregistrata
    // etc.) → widget gol pe homepage. Acum: orice nu este final (rezolvat /
    // respins / ignorat) e considerat „activ".
    const { data, error } = await supabase
      .from("sesizari_feed")
      .select(
        "id,code,titlu,tip,status,sector,locatie,voturi_net,nr_comentarii",
      )
      .not("status", "in", "(rezolvat,respins,ignorat)")
      .order("voturi_net", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json(
      { data: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
