import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { scrapeEventPage } from "@/lib/proteste/event-scrape";
import {
  callGemini,
  isGeminiConfigured,
  GEMINI_MODEL,
  GEMINI_MODEL_FAST,
} from "@/lib/ai/gemini";
import { getGroqClient, GROQ_MODEL, GROQ_MODEL_FAST } from "@/lib/groq/client";
import { ALL_COUNTIES } from "@/data/counties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const inputSchema = z.object({ url: z.string().url().max(2000) });

/** SSRF guard — endpoint PUBLIC care face fetch server-side la un URL dat de user.
 *  Respinge localhost / IP-uri private / metadata cloud (169.254.169.254) etc.
 *  Acoperă vectorii direcți; redirect-to-internal rămâne reziduu mic (baseline UE). */
function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Blochează ORICE literal IPv6 — niciun link de protest legit nu folosește unul,
  // iar formele ::1 / fe80 / ::ffff:127.0.0.1 (IPv4-mapped) sunt vectori SSRF.
  if (host.includes(":")) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return false; // any-local / loopback / private
    if (a === 169 && b === 254) return false; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a >= 224) return false; // multicast / reserved
  }
  return true;
}

const SYSTEM_PROMPT = `Ești un extractor de date despre PROTESTE / mitinguri / evenimente civice publice din România. Primești textul unei pagini web (eveniment Facebook, articol de presă, pagina organizatorului) și extragi UN obiect JSON cu câmpurile de mai jos. Folosește null (sau [] pentru liste) când NU găsești cu încredere — NU inventa.

Câmpuri:
- title: titlu scurt al evenimentului (string)
- subtitle: o singură propoziție rezumat (string|null)
- cause: cauza în 3-8 cuvinte (string|null)
- description: descriere 2-5 propoziții despre ce/de ce (string|null)
- start_at: dată+oră ISO 8601 cu fusul României, ex "2026-07-15T18:00:00+03:00". REZOLVĂ datele relative folosind DATA DE AZI (dată mai jos). null dacă nu există dată.
- end_at: ISO 8601 sau null
- location_name: numele locului, ex "Piața Victoriei" (string|null)
- city: orașul (string|null)
- county: NUMELE județului românesc, ex "București", "Cluj", "Timiș" (string|null)
- organizer: cine organizează (string|null)
- organizer_url: site-ul organizatorului (string|null)
- hashtag: hashtag campanie cu # (string|null)
- expected_attendance: număr întreg sau null
- demands: listă de revendicări scurte (max 10) sau []

Reguli STRICTE (anti-halucinație):
- NU INVENTA. organizer_url, hashtag, demands, organizer, expected_attendance: pune-le DOAR dacă apar EXPLICIT în text. Altfel null / [] / "".
- NU pune un site de organizator (ex. declic.ro) dacă nu e scris în text. NU inventa hashtag-uri.
- Dacă ți se dau deja titlul/locația/data ca „cunoscute exact", NU le contrazice — concentrează-te pe restul.
- organizer = numele din "organizat de X" / "Event by X", dacă apare; altfel null.
- expected_attendance = doar dacă e un număr clar de participanți în text.
Output în ROMÂNĂ. Returnează DOAR obiectul JSON, fără markdown, fără explicații.`;

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bjude[a-z]*\b|\bmunicipiul\b|\bjud\.?\b/g, "")
    .trim();
}

function countyNameToSlug(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "";
  const n = normalizeName(name);
  const hit = ALL_COUNTIES.find((c) => normalizeName(c.name) === n);
  return hit?.slug ?? "";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Scrape + 1 apel AI per request → tier free abuzabil. 20/h per IP +
  // un plafon GLOBAL (un botnet nu poate goli cota AI partajată din IP-uri rotite).
  const [rl, rlGlobal] = await Promise.all([
    rateLimitAsync(`proteste-extract:${ip}`, { limit: 20, windowMs: 60 * 60_000 }),
    rateLimitAsync("proteste-extract:global", { limit: 300, windowMs: 60 * 60_000 }),
  ]);
  if (!rl.success || !rlGlobal.success) {
    return NextResponse.json(
      { error: "Prea multe extrageri. Încearcă din nou peste o oră sau completează manual." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid." }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Link invalid." }, { status: 400 });
  }
  const url = parsed.data.url;
  if (!isSafePublicUrl(url)) {
    return NextResponse.json({ error: "Link neacceptat. Folosește un link public (http/https)." }, { status: 400 });
  }

  if (!isGeminiConfigured() && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "AI nu e configurat. Completează câmpurile manual." },
      { status: 503 },
    );
  }

  // 1. Scrape STRUCTURAT — Facebook (JSON de relay) / JSON-LD dau data, locația și
  //    descrierea EXACTE, embedate în pagină. Le scoatem DETERMINIST (autoritative)
  //    ca AI-ul să NU le ghicească (cauza halucinațiilor de dată/locație).
  const ev = await scrapeEventPage(url);
  if (!ev.ok && !ev.title && ev.aiText.length < 60) {
    return NextResponse.json(
      {
        error:
          "Nu am putut citi pagina (poate e privat sau blochează roboții). Completează manual sau încearcă alt link.",
      },
      { status: 422 },
    );
  }

  // 2. Prompt — AI scoate doar câmpurile „soft" (cauză/subtitlu/hashtag/revendicări/
  //    organizator) din text. Data/locația/descrierea vin din `ev` (autoritative).
  const today = new Date().toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
  const known = [
    ev.title ? `Titlu: ${ev.title}` : "",
    ev.startIso ? "(data și ora sunt deja cunoscute EXACT din pagină — nu le recalcula)" : "",
    ev.locationName ? `Locație: ${ev.locationName}` : "",
    ev.city ? `Oraș: ${ev.city}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const userPrompt = `DATA DE AZI: ${today}\n\nEVENIMENT (${url})\n${known}\n\n${ev.aiText}\n\nReturnează DOAR JSON conform schemei.`;

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];
  const flatPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;
  const max_tokens = 1200;

  type Candidate = { run: () => Promise<string> };
  const candidates: Candidate[] = [];
  if (isGeminiConfigured()) {
    candidates.push(
      {
        run: async () =>
          (await callGemini({
            messages: [{ role: "user" as const, content: flatPrompt }],
            model: "gemma-3-27b-it",
            temperature: 0.3,
            max_tokens,
          })) ?? "",
      },
      {
        run: async () =>
          (await callGemini({
            messages,
            model: GEMINI_MODEL,
            temperature: 0.3,
            max_tokens,
            response_format: { type: "json_object" },
          })) ?? "",
      },
      {
        run: async () =>
          (await callGemini({
            messages,
            model: GEMINI_MODEL_FAST,
            temperature: 0.3,
            max_tokens,
            response_format: { type: "json_object" },
          })) ?? "",
      },
    );
  }
  if (process.env.GROQ_API_KEY) {
    const groq = getGroqClient();
    const groqRun = (model: string) => async () => {
      const c = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens,
        response_format: { type: "json_object" },
      });
      return c.choices[0]?.message?.content?.trim() ?? "";
    };
    candidates.push({ run: groqRun(GROQ_MODEL) }, { run: groqRun(GROQ_MODEL_FAST) });
  }

  let raw: string | null = null;
  let allRateLimited = candidates.length > 0;
  for (const cand of candidates) {
    try {
      const out = await cand.run();
      if (out && out.length > 15) {
        raw = out;
        allRateLimited = false;
        break;
      }
      allRateLimited = false;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status !== 429) allRateLimited = false;
      if (status === 401 || status === 403) break;
    }
  }

  if (!raw) {
    return NextResponse.json(
      {
        error: allRateLimited
          ? "Cotele AI sunt epuizate momentan. Încearcă peste câteva minute sau completează manual."
          : "AI nu a putut extrage datele. Completează manual câmpurile.",
      },
      { status: allRateLimited ? 429 : 502 },
    );
  }

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  let j: Record<string, unknown>;
  try {
    j = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "AI a returnat răspuns invalid. Completează manual." },
      { status: 502 },
    );
  }

  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  // Data de început trebuie să fie parsabilă ȘI în viitor (protestul se PROPUNE).
  // O dată în trecut = eroare AI (an greșit) → mai bine gol (userul observă).
  const futureIso = (v: unknown): string => {
    const s = str(v);
    if (!s) return "";
    const t = Date.parse(s);
    if (Number.isNaN(t) || t < Date.now() - 24 * 3600_000) return "";
    return s;
  };
  const validIso = (v: unknown): string => {
    const s = str(v);
    return s && !Number.isNaN(Date.parse(s)) ? s : "";
  };
  const numOrEmpty = (v: unknown): string => {
    const n = typeof v === "number" ? v : Number(str(v));
    return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
  };
  const demands = Array.isArray(j.demands)
    ? j.demands.filter((d): d is string => typeof d === "string" && d.trim().length > 0).map((d) => d.trim()).slice(0, 10)
    : [];

  // Merge: câmpurile STRUCTURATE din `ev` (Facebook/JSON-LD) sunt AUTORITATIVE —
  // bat AI-ul pt. dată/locație/descriere/titlu. AI-ul umple restul (soft).
  const data = {
    title: ev.title || str(j.title),
    subtitle: str(j.subtitle),
    cause: str(j.cause),
    description: ev.description || str(j.description),
    start_at: ev.startIso || futureIso(j.start_at),
    end_at: ev.endIso || validIso(j.end_at),
    location_name: ev.locationName || str(j.location_name),
    city: ev.city || str(j.city),
    county_slug: countyNameToSlug(str(j.county)) || countyNameToSlug(ev.city ?? ""),
    organizer: str(j.organizer),
    organizer_url: str(j.organizer_url),
    external_url: url,
    hashtag: str(j.hashtag),
    expected_attendance: numOrEmpty(j.expected_attendance),
    demands,
  };

  const filled = Object.entries(data).filter(
    ([k, v]) => k !== "external_url" && (Array.isArray(v) ? v.length > 0 : !!v),
  ).length;

  return NextResponse.json({
    data,
    filledCount: filled,
    source: { url, title: ev.title ?? null },
  });
}
