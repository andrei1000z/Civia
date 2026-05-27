import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { generateFormalText, getPrefabActions } from "@/lib/sesizari/formal-template";
import { reformulateDescriere, reorderActions } from "@/lib/sesizari/reformulate-descriere";

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

    // 2026-05-27 — 2 apeluri AI în PARALEL pentru latency optim:
    //   1. reformulateDescriere: scrieri colocviale → registru oficial
    //      (PĂSTRÂND faptele, fără solicitări care duplică lista)
    //   2. reorderActions: ia acțiunile prefab pentru tip-ul respectiv și
    //      le REORDONEAZĂ în ordine imediat → planificare → permanent
    //      (păstrează textul prefab + referințele legale exact).
    // Pe eșec AI ambele cad în picioare cu fallback la comportament prefab.
    const tipFinal = tip ?? "altele";
    const prefab = getPrefabActions(tipFinal);
    const [descriereReformulata, customActions] = await Promise.all([
      reformulateDescriere(descriere),
      reorderActions({ tip: tipFinal, descriere, prefabActions: prefab }),
    ]);

    const formal_text = generateFormalText({
      tip: tipFinal,
      locatie: locatie ?? "",
      descriere: descriereReformulata,
      nume: nume ?? null,
      adresa: adresa ?? null,
      hasPhotos: (imagini ?? []).length > 0,
      customActions,
    });

    return NextResponse.json({ data: { formal_text } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Input invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Eroare la generare" }, { status: 500 });
  }
}
