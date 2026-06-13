import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/sesizari/recent — cele mai recente sesizări active, pentru
 * widget-ul homepage „Ce semnalează cetățenii acum".
 *
 * 2026-06-03 — Înlocuiește /top-voted (votarea a fost eliminată). Ordonare
 * după created_at desc. Payload minim (fără formal_text/descriere/imagini).
 */
export async function GET(req: Request) {
  const rl = await rateLimitAsync(`recent-sesizari:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea rapid" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 50) : 10;
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("sesizari_feed")
      .select("id,code,titlu,tip,status,sector,locatie,nr_comentarii,created_at")
      .not("status", "in", "(rezolvat,respins,ignorat)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json(
      { data: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
