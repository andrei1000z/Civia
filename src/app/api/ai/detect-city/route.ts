/**
 * POST /api/ai/detect-city
 *
 * 2026-05-26 — Detectează orașul + sectorul (pentru București) dintr-o
 * adresă liberă scrisă de user. Folosește Groq Llama 3.1 8B Instant ca
 * fallback la `detectCountyFromLocatie` (regex-based) când userul scrie
 * forme ambigue: „str X colt cu Bdul Y", „lângă Universitate", etc.
 *
 * Apelat din SesizareForm cu debounce 3s după ce userul a terminat de
 * tastat în câmpul locatie. Rezultatul actualizează detectedCounty +
 * detectedSector → preview-ul destinatarilor reflectă corect.
 *
 * Cost: 8B Instant ~ <100 tokens, ~ $0.00001 / call. Cache identice
 * inputuri 60s în Redis ca să nu re-rulăm pentru același text.
 *
 * Rate-limit: 30 calls/IP/min — generos pentru user care iterează în
 * formul de sesizare.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqClient, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { analyticsRedis } from "@/lib/analytics/redis";
import { ALL_COUNTIES } from "@/data/counties";

export const dynamic = "force-dynamic";
export const maxDuration = 8;

const schema = z.object({
  locatie: z.string().min(4, "Adresa prea scurtă").max(500),
});

const SYSTEM_PROMPT = `Ești un asistent care identifică orașul și județul din România dintr-o adresă liberă.
RĂSPUNDE STRICT cu JSON valid în formatul:
{"county": "CJ", "city": "Cluj-Napoca", "sector": null}

REGULI:
- county = cod judet 2 litere (B=București, CJ=Cluj, IS=Iași, TM=Timiș, etc.)
- city = numele orașului identificat (sau null dacă nu e clar)
- sector = "S1"/"S2"/"S3"/"S4"/"S5"/"S6" DOAR pentru București bazat pe stradă/zona menționată; null altfel
- Dacă adresa e ambiguă sau incompletă, returnează cel mai probabil match
- Dacă chiar nu poți identifica, county=null

EXEMPLE:
"Strada Lipscani 12" → {"county":"B","city":"București","sector":"S3"}
"Bdul Eroilor, Cluj-Napoca" → {"county":"CJ","city":"Cluj-Napoca","sector":null}
"Calea Victoriei, Sector 1" → {"county":"B","city":"București","sector":"S1"}
"str X 12, Iași" → {"county":"IS","city":"Iași","sector":null}
"Drumul Taberei" → {"county":"B","city":"București","sector":"S6"}
"asdf qwerty" → {"county":null,"city":null,"sector":null}

NU adăuga text înainte/după. NU markdown. NUMAI JSON.`;

const VALID_COUNTY_IDS = new Set(ALL_COUNTIES.map((c) => c.id));

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`detect-city:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input invalid" }, { status: 400 });
  }
  const locatie = parsed.data.locatie.trim();

  // Cache 60s pentru același input — userul tastează rapid în form,
  // multiple debounce-flushes pot trimite același text.
  const cacheKey = `detect-city:${locatie.toLowerCase().replace(/\s+/g, " ")}`;
  if (analyticsRedis) {
    try {
      const cached = await analyticsRedis.get<{
        county: string | null;
        city: string | null;
        sector: string | null;
      }>(cacheKey);
      if (cached) {
        return NextResponse.json({ data: cached, cached: true });
      }
    } catch {
      // Redis miss, continue
    }
  }

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      temperature: 0,
      max_tokens: 100,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: locatie },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsedJson: { county?: unknown; city?: unknown; sector?: unknown };
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return NextResponse.json({ data: { county: null, city: null, sector: null } });
    }

    // Validate + sanitize
    const countyRaw = typeof parsedJson.county === "string" ? parsedJson.county.toUpperCase() : null;
    const county = countyRaw && VALID_COUNTY_IDS.has(countyRaw) ? countyRaw : null;
    const city = typeof parsedJson.city === "string" ? parsedJson.city.slice(0, 80) : null;
    const sectorRaw = typeof parsedJson.sector === "string" ? parsedJson.sector.toUpperCase() : null;
    const sector =
      county === "B" && sectorRaw && /^S[1-6]$/.test(sectorRaw) ? sectorRaw : null;

    const result = { county, city, sector };

    // Cache 60s
    if (analyticsRedis) {
      try {
        await analyticsRedis.set(cacheKey, result, { ex: 60 });
      } catch {
        // ignore cache errors
      }
    }

    return NextResponse.json({ data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare AI";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
