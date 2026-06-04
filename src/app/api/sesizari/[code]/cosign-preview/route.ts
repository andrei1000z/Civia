/**
 * GET /api/sesizari/[code]/cosign-preview?nume=...&adresa=...
 *
 * 2026-05-26 — Endpoint pentru a previzualiza emailul real ÎNAINTE de
 * trimitere. User vede exact ce va pleca către primării: destinatari,
 * subject, corpul mesajului cu nume + adresa substituite.
 *
 * Folosește aceeași logică ca cosign-send (getAuthoritiesFor +
 * buildFormalText + fallback county detection) → preview-ul reflectă
 * 100% emailul real, nu o aproximare client-side.
 *
 * Rate-limit blând (30/min/IP) — previewul e ieftin (no email send).
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { safeTitlu } from "@/lib/sesizari/titlu";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { buildFormalText } from "@/lib/sesizari/mailto";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const ip = getClientIp(req);

  const rl = await rateLimitAsync(`cosign-preview:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }

  const url = new URL(req.url);
  const nume = (url.searchParams.get("nume") || "").trim().slice(0, 100);
  const adresa = (url.searchParams.get("adresa") || "").trim().slice(0, 300);
  if (nume.length < 2 || adresa.length < 3) {
    return NextResponse.json(
      { error: "Completează numele și adresa pentru preview" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, tip, locatie, sector, county, descriere, formal_text, imagini")
    .eq("code", code)
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { error: "Sesizare negăsită sau nepublică" },
      { status: 404 },
    );
  }

  const sez = data as {
    id: string;
    code: string;
    titlu: string;
    tip: string;
    locatie: string;
    sector: string;
    county: string | null;
    descriere: string;
    formal_text: string | null;
    imagini: string[] | null;
  };

  // Fallback county (same logic ca cosign-send)
  let effectiveCounty = sez.county;
  if (!effectiveCounty) {
    effectiveCounty = detectCountyFromLocatie(sez.locatie);
  }

  // Resolve recipients (cu descriere pentru auto-escalation politie)
  const recipients = getAuthoritiesFor(
    sez.tip,
    sez.sector,
    effectiveCounty,
    sez.locatie,
    undefined,
    sez.descriere,
  );

  // Build formal text cu identitatea co-semnatarului
  const formalText = buildFormalText({
    tip: sez.tip,
    titlu: sez.titlu,
    locatie: sez.locatie,
    sector: sez.sector,
    descriere: sez.descriere ?? "",
    formal_text: sez.formal_text,
    author_name: nume,
    author_email: null,
    author_address: adresa,
    imagini: sez.imagini ?? [],
    code: sez.code,
  });

  // 2026-05-27 — fără prefix „Co-semnătură" (user request): emailul să arate
  // ca o sesizare regulată către primărie. Match cu subject din cosign-send.
  const subject = `Sesizare ${sez.code} — ${safeTitlu(sez.titlu, { descriere: sez.descriere })}`;
  const recipientsLine = [...recipients.primary, ...recipients.cc]
    .map((r) => `${r.name} <${r.email}>`)
    .join(", ");

  return NextResponse.json({
    data: {
      recipients: recipientsLine,
      recipientsLabel: recipients.label,
      // 2026-05-26 — Listă structurată pentru UI bogat (chips cu nume +
      // email separat). Modal-ul de preview folosește astea ca să arate
      // destinatarii ca cards individuale.
      to: recipients.primary.map((r) => ({ name: r.name, email: r.email })),
      cc: recipients.cc.map((r) => ({ name: r.name, email: r.email })),
      subject,
      body: formalText,
      hasPhotos: (sez.imagini ?? []).length > 0,
      photoCount: (sez.imagini ?? []).length,
    },
  });
}
