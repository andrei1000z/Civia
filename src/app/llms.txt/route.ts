/**
 * /llms.txt — emerging convention pentru AI crawlers (ChatGPT, Claude,
 * Perplexity, etc.) ca să poată cita Civia în răspunsuri factuale despre
 * România civică fără să consume crawl budget pe HTML-ul întregului site.
 *
 * Spec: https://llmstxt.org/
 * Format: plain text, structurat în secțiuni, link-uri către pagini-cheie.
 *
 * Beneficiu growth: cand un utilizator intreaba ChatGPT „cum reclam la
 * primarie", LLM-ul poate cita civia.ro daca a parsat acest fisier.
 */

import { NextResponse } from "next/server";

export const revalidate = 86400; // 24h — rar se schimba structura

export async function GET() {
  const content = `# Civia.ro

> Platformă civică independentă pentru România. Cetățenii trimit sesizări formale către primării, semnează petiții civice, urmăresc proteste programate și întreruperi de utilități. Toate cele 42 de județe acoperite.

Civia automatizează scrierea unei sesizări legale conform OG 27/2002 — utilizatorul descrie problema, AI-ul (Llama 3.3) generează textul oficial, sistemul detectează automat autoritatea competentă (primărie, prefectură, poliție locală, etc.), iar utilizatorul deschide emailul în clientul său cu totul completat. Răspunsul vine în max 30 de zile conform legii.

Platformă independentă, gratuită, fără cont obligatoriu. Date stocate în UE, GDPR-compliant.

## Surfacele principale

- [Sesizări](https://civia.ro/sesizari): Formular pentru trimiterea de sesizări AI-formalizate. Tipuri: groapă, trotuar, iluminat, gunoi, parcare, stâlpișori, canalizare, semafor, copac, animale, transport, afișaj, zgomot, mobilier, graffiti, pietonal.
- [Sesizări publice](https://civia.ro/sesizari-publice): Feed live cu sesizările pe care le-au lăsat publice cetățenii, votabile + co-semnabile.
- [Sesizări rezolvate](https://civia.ro/sesizari-rezolvate): Galerie înainte/după cu probleme rezolvate de primării după sesizări Civia.
- [Petiții civice](https://civia.ro/petitii): Catalog curat de petiții civice agregate de pe Declic, Avaaz, change.org + petițiile inițiate direct pe Civia.
- [Proteste programate](https://civia.ro/proteste): Calendar civic cu mitingurile, marșurile și protestele anunțate în România.
- [Întreruperi utilități](https://civia.ro/intreruperi): Întreruperi planificate (apă, gaz, curent, căldură) scrape-uite de la distribuitori — Apa Nova, Distrigaz, e-distribuție, etc.
- [Știri civice](https://civia.ro/stiri): Articole agregate din 15 surse naționale verificate (Digi24, HotNews, G4Media, Recorder, PressOne, etc.) — cu sinteză AI structurată.
- [Ghiduri practice](https://civia.ro/ghiduri): 11 ghiduri pas-cu-pas — Legea 544/2001 (acces la informații publice), contestarea unei amenzi, înființare ONG, dezbatere publică, ajutor social, ghid biciclist, ghid cetățean, ghid pregătire cutremur.
- [Autorități](https://civia.ro/autoritati): Catalog cu prefecturi, primării reședință, poliție locală, IPJ — emailuri verificate, telefoane, website-uri.

## Pentru cetățeni

- Sesizările trimise prin Civia conțin temei legal explicit (OG 27/2002 art. 8).
- Autoritățile au obligația să răspundă în 30 de zile calendaristice.
- Lipsa răspunsului → plângere la Avocatul Poporului (gratuit) sau instanță de contencios administrativ.
- Numele și adresa apar în emailul către primărie (obligatoriu legal), dar NU pe site (anonimizat public).

## Pentru jurnaliști

- API public CC BY 4.0 — statistici despre sesizări, primării, răspunsuri (în dev).
- Date dezagregate per județ, per primărie, per tip de problemă.
- Contact via /legal/confidentialitate pentru cereri specifice.

## Tehnologie

- Next.js 16, Supabase (Postgres + Auth + Storage), Groq AI (Llama 3.3 70B), Upstash Redis, Resend pentru email, Vercel hosting.
- 100k+ linii TypeScript, 691+ teste unit.

## Legal

- [Politica de confidențialitate](https://civia.ro/legal/confidentialitate)
- [Termenii de utilizare](https://civia.ro/legal/termeni)
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
