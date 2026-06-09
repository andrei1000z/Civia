import { NextResponse } from "next/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sesizareToPetitieCategorie } from "@/lib/petitii/chaining";
import { listRelatedPetitii } from "@/lib/petitii/related";

export const dynamic = "force-dynamic";

/**
 * GET /api/petitii/related?tip=...&county=...&limit=3
 *
 * Chaining sesizare→petiție (Faza 1): pentru un tip de sesizare, întoarce 1-3
 * petiții pe aceeași temă (categorie mapată) + județ. Folosit de
 * RelatedPetitiiCard în SuccessScreen. Public (citește doar petiții publice).
 * Zero match (tip generic / fără petiții) → count:0 → cardul se ascunde.
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`petitii-related:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "Prea multe cereri" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const tip = searchParams.get("tip");
  const countyRaw = searchParams.get("county");
  const limitRaw = searchParams.get("limit");

  // Validare conservatoare a inputului (nu trust query params).
  if (!tip || !/^[a-z_]{1,40}$/i.test(tip)) {
    return NextResponse.json({ ok: true, count: 0, petitii: [] });
  }
  const county = countyRaw && /^[A-Z]{1,3}$/i.test(countyRaw) ? countyRaw.toUpperCase() : null;
  const limit = Math.min(Math.max(Number(limitRaw) || 3, 1), 5);

  const categorie = sesizareToPetitieCategorie(tip);
  if (!categorie) {
    return NextResponse.json({ ok: true, count: 0, petitii: [] });
  }

  const petitii = await listRelatedPetitii({ categorie, county, limit });
  return NextResponse.json({ ok: true, count: petitii.length, petitii });
}
