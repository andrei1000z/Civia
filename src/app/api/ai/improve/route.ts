import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { generateFormalText } from "@/lib/sesizari/formal-template";

/**
 * Generator text formal sesizare — TEMPLATE DETERMINIST, fără AI.
 *
 * Rewrite 2026-05-24: user a cerut explicit „DA UN MODEL SIMPLU SI GATA"
 * după ani de AI cu prompt-uri complexe care produceau variații
 * imprevizibile (Subsemnatul vs Mă numesc, fraze de minimizare, fraze
 * de dramatizare, placeholders ne-substituite, etc.).
 *
 * Acum: pur substituție template. Aceeași combinație tip + locație +
 * nume + adresă produce ÎNTOTDEAUNA același text. Predictibil.
 *
 * Endpoint păstrat pe path-ul vechi pentru compatibilitate cu UI-ul
 * existent (formul cheamă POST /api/ai/improve la click „Generează").
 */
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const schema = z.object({
  descriere: z.string().min(5).max(2000),
  tip: z.string().optional(),
  locatie: z.string().optional(),
  nume: z.string().optional(),
  adresa: z.string().optional(),
  imagini: z.array(z.string().url()).max(5).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`ai-improve:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: `Prea multe cereri. Reîncearcă în ${Math.ceil(rl.resetIn / 1000)}s.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const { descriere, tip, locatie, nume, adresa, imagini } = schema.parse(body);

    const formal_text = generateFormalText({
      tip: tip ?? "altele",
      locatie: locatie ?? "",
      // 2026-05-25 — pasăm descrierea cetățeanului ca să apară EXACT cum
      // a scris-o el în formal text. Înainte era ignorată, ceea ce ducea
      // la halucinații (tram fence → boilerplate despre stâlpișori).
      descriere,
      nume: nume ?? null,
      adresa: adresa ?? null,
      hasPhotos: (imagini ?? []).length > 0,
    });

    return NextResponse.json({ data: { formal_text } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Input invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Eroare la generare" }, { status: 500 });
  }
}
