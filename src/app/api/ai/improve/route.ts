import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { generateFormalText, getPrefabActions } from "@/lib/sesizari/formal-template";
import {
  reformulateDescriere,
  reorderActions,
  reformulateAdresa,
  generateContextualActions,
} from "@/lib/sesizari/reformulate-descriere";
import { detectsPoliceContext } from "@/lib/sesizari/authorities";

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
// 2026-06-05 — 10s → 30s: 4 apeluri AI în paralel, fiecare cu fallback Gemini
// (mai lent când Groq e 429). La 10s timeout-a → Vercel întorcea non-JSON →
// clientul arăta „Unexpected token A".
export const maxDuration = 30;

const schema = z.object({
  descriere: z.string().min(5).max(2000),
  tip: z.string().optional(),
  locatie: z.string().optional(),
  nume: z.string().optional(),
  adresa: z.string().optional(),
  sector: z.string().optional(),
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
    const { descriere, tip, locatie, nume, adresa, sector, imagini } = schema.parse(body);

    // 2026-05-27/28 — 4 apeluri AI în PARALEL pentru latency optim:
    //   1. reformulateDescriere: scrieri colocviale → registru oficial
    //   2. reorderActions: prefab → reordonate imediat→planificare→permanent
    //   3. reformulateAdresa(adresa): adresa cetățeanului → format formal
    //      cu diacritice + abrevieri expandate (str→Strada, sos→Șoseaua etc)
    //   4. reformulateAdresa(locatie): locația problemei → același tratament
    // Toate au fallback la input brut dacă AI eșuează.
    const tipFinal = tip ?? "altele";
    const prefab = getPrefabActions(tipFinal);

    // 2026-05-29 — Decide intre prefab + reorder VS contextual actions.
    // Cazuri unde generam contextual din descriere (user-raport):
    //   • tip = "altele" → prefab e generic ("Verificarea situatiei...")
    //   • context politie detectat in descriere (vehicul pe trotuar, politie
    //     inactiva, plate raportata) → prefab pentru groapa/iluminat/etc
    //     ratează specificul cazului
    // Restul cazurilor: prefab + reorder logic (mai predictibil).
    const police = detectsPoliceContext(descriere, locatie);
    const needsContextualActions =
      tipFinal === "altele" || police.needsTraffic || police.needsLocal;

    const actionsPromise = needsContextualActions
      ? generateContextualActions({
          descriere,
          tip: tipFinal,
          locatie,
          prefabFallback: prefab,
        })
      : reorderActions({ tip: tipFinal, descriere, prefabActions: prefab });

    const [descriereReformulata, customActions, adresaNorm, locatieNorm] = await Promise.all([
      reformulateDescriere(descriere, { tip: tipFinal }),
      actionsPromise,
      reformulateAdresa(adresa),
      reformulateAdresa(locatie),
    ]);

    // 2026-06-05 — Adaugă sectorul detectat (+ București) în locația din text,
    // dacă lipsește. User: adresa „refăcută corect" trebuie să includă „Sector 1".
    let locatieFinal = locatieNorm ?? locatie ?? "";
    if (sector && /^S[1-6]$/.test(sector) && !/sector/i.test(locatieFinal)) {
      locatieFinal = `${locatieFinal.replace(/[,\s]+$/, "")}, Sector ${sector.slice(1)}, București`;
    }

    const formal_text = generateFormalText({
      tip: tipFinal,
      locatie: locatieFinal,
      descriere: descriereReformulata,
      nume: nume ?? null,
      adresa: adresaNorm || (adresa ?? null),
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
