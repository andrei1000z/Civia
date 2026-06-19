import { NextResponse } from "next/server";
import { searchAddress } from "@/lib/geo/reverse-geocode";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/geocode/search?q=Strada+Exemplu+12+Bucuresti
 * Forward geocode (autocomplete adresă) → sugestii cu coordonate exacte.
 *
 * De ce: pe GPS imprecis (desktop/wifi ±km) reverse-geocode-ul ghicea o stradă
 * apropiată GREȘITĂ. Aici userul scrie adresa lui și primește locul EXACT.
 * Rate-limited (politica Nominatim 1 req/s).
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ data: [] });

  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`geocode-search:${ip}`, { limit: 4, windowMs: 1000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea rapid — așteaptă o secundă", data: [] }, { status: 429 });
  }

  try {
    const data = await searchAddress(q);
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ data: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
