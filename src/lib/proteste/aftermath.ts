/**
 * Shared types + AI prompt + scrape helper for "Cum a fost" (aftermath)
 * pe proteste. Aftermath-ul e umplut DUPĂ ce protestul a avut loc, fie
 * manual de organizator/cetățean, fie auto din 1-10 link-uri de presă
 * pe care le agregăm + sintetizăm cu Gemini.
 */

import { z } from "zod";
import { extractArticleBody } from "@/lib/stiri/extract-body";

// ============================================================
// Types
// ============================================================

export interface AftermathImage {
  url: string;
  credit?: string;
  caption?: string;
}

export interface AftermathVideo {
  url: string;
  title?: string;
  source?: string; // youtube | tiktok | instagram | facebook | direct
}

export interface AftermathSource {
  url: string;
  title?: string;
  publication?: string;
  snippet?: string;
}

export interface AftermathData {
  attendance_estimate: number | null;
  narrative: string;
  chants: string[];
  key_moments: string[];
  outcome: string;
  images: AftermathImage[];
  videos: AftermathVideo[];
  sources: AftermathSource[];
}

export const EMPTY_AFTERMATH: AftermathData = {
  attendance_estimate: null,
  narrative: "",
  chants: [],
  key_moments: [],
  outcome: "",
  images: [],
  videos: [],
  sources: [],
};

// ============================================================
// Validation schemas (used by API routes)
// ============================================================

export const aftermathImageSchema = z.object({
  url: z.string().url().max(2000),
  credit: z.string().trim().max(200).optional(),
  caption: z.string().trim().max(400).optional(),
});

export const aftermathVideoSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().trim().max(300).optional(),
  source: z.string().trim().max(40).optional(),
});

export const aftermathSourceSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().trim().max(400).optional(),
  publication: z.string().trim().max(120).optional(),
  snippet: z.string().trim().max(600).optional(),
});

export const aftermathDataSchema = z.object({
  attendance_estimate: z
    .number()
    .int()
    .nonnegative()
    .max(10_000_000)
    .nullable(),
  narrative: z.string().trim().max(8000).default(""),
  chants: z.array(z.string().trim().min(1).max(280)).max(40).default([]),
  key_moments: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  outcome: z.string().trim().max(4000).default(""),
  images: z.array(aftermathImageSchema).max(40).default([]),
  videos: z.array(aftermathVideoSchema).max(20).default([]),
  sources: z.array(aftermathSourceSchema).max(15).default([]),
});

// ============================================================
// AI Prompt — aftermath synthesis from scraped news article bodies
// ============================================================

export const AFTERMATH_SYSTEM_PROMPT = `Ești un asistent care sintetizează ce s-a întâmplat la un protest civic românesc, pe baza articolelor de presă agregate.

Primești:
- Titlul și data protestului (context)
- 1-10 articole de presă scrise DUPĂ protest (corpul textual extras + URL-ul sursei)

Sarcina ta: extragi DOAR fapte verificabile din articole, le centralizezi într-un raport structurat. NU INVENTA informații care nu sunt în input.

Returnezi DOAR JSON valid în formatul EXACT de mai jos:

{
  "attendance_estimate": număr întreg sau null — estimarea participanților dacă apare în CEL PUȚIN un articol. Dacă mai multe articole dau cifre diferite, alege MEDIANA. Dacă nimic, null.,
  "narrative": "string — 3-6 paragrafe (max 1500 chars total) care povestește cum a decurs protestul: atmosfera, traseul, momentele importante, reacția participanților și autorităților. Stil jurnalistic neutru, NU partizan. Folosește diacritice corecte.",
  "chants": ["array de string-uri — sloganurile efectiv scandate, citate textual din articole. Max 12 elemente. Dacă nu apar sloganuri menționate explicit, ARRAY GOL []."],
  "key_moments": ["array de momente cronologice scurte (max 8). Format: 'HH:MM — descriere scurtă' SAU 'descriere scurtă'. Ex: '17:30 — pornire marș de la Universitate', 'discurs reprezentant Greenpeace'. Doar momente menționate explicit în articole."],
  "outcome": "string — ce a urmat după protest (max 800 chars): declarații oficiale, decizii, promisiuni ale autorităților, reacția politică. Dacă articolele nu menționează nimic post-eveniment, șir gol \\"\\".",
  "images_found": ["array de URL-uri ABSOLUTE (cu https://) către imagini din articole — caută în corpul textual referințe la URL-uri de tip .jpg/.jpeg/.png/.webp. Max 10. Dacă nu sunt evidente, ARRAY GOL."],
  "videos_found": ["array de URL-uri ABSOLUTE către videoclipuri menționate (YouTube, TikTok, Facebook video, direct .mp4). Max 5. Doar dacă sunt menționate în text."]
}

REGULI STRICTE:
- TOTUL în română corectă cu diacritice (ă, â, î, ș, ț).
- NU adăuga câmpuri suplimentare. NU folosi markdown (e JSON).
- NU pune text înainte/după JSON.
- Atribuie cifre/declarații DOAR dacă apar în articole. Mai bine null decât invenție.
- Dacă articolele se contrazic, prioritizează sursele oficiale (HotNews, Digi24, G4Media, Adevărul) > tabloide > Facebook.
- NU adăuga opinii proprii sau interpretări politice. Doar fapte.`;

// ============================================================
// Scrape multiple URLs in parallel + return enriched sources
// ============================================================

export interface ScrapedArticle {
  url: string;
  title: string | null;
  publication: string | null;
  body: string | null;
  ogImage: string | null;
  fetchedAt: string;
  ok: boolean;
  error?: string;
}

const FETCH_TIMEOUT_MS = 6000;
const UA =
  "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Pull title + OG image + first 200 chars of body from an article URL.
 * Used both for AI synthesis input AND for displaying source cards on
 * the public aftermath section.
 */
export async function scrapeArticleMeta(url: string): Promise<ScrapedArticle> {
  const fetchedAt = new Date().toISOString();
  if (!/^https?:\/\//i.test(url)) {
    return { url, title: null, publication: null, body: null, ogImage: null, fetchedAt, ok: false, error: "URL invalid" };
  }

  let html = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5",
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { url, title: null, publication: null, body: null, ogImage: null, fetchedAt, ok: false, error: `HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { url, title: null, publication: null, body: null, ogImage: null, fetchedAt, ok: false, error: msg };
  }

  if (!html || html.length < 200) {
    return { url, title: null, publication: null, body: null, ogImage: null, fetchedAt, ok: false, error: "html prea scurt" };
  }

  // Title — preferă OG title, fallback la <title>
  const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const title = (ogTitle ?? titleTag ?? "").trim().slice(0, 400) || null;

  // OG image
  const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;

  // Site name → publication
  const ogSite = html.match(/<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i)?.[1];
  let publication = ogSite?.trim().slice(0, 120) ?? null;
  if (!publication) {
    try {
      publication = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      publication = null;
    }
  }

  // Body — folosim extractor-ul existent, dar pe HTML-ul deja fetch-uit
  // ar fi un duplicate fetch. Pentru MVP lasăm extractor-ul să refacă
  // request-ul (cache la nivel de fetch HTTP poate să-l prindă).
  const body = await extractArticleBody(url);

  return { url, title, publication, body, ogImage, fetchedAt, ok: true };
}

export async function scrapeMultiple(urls: string[]): Promise<ScrapedArticle[]> {
  // Limit to 10 — input schema enforces at API boundary too, dar
  // belt-and-suspenders aici nu strica.
  const safe = urls.slice(0, 10);
  // În paralel — fetch-urile sunt I/O bound, parallel 10 nu strică nimic.
  return Promise.all(safe.map((u) => scrapeArticleMeta(u)));
}

// ============================================================
// Sanitize AI response
// ============================================================

interface AiAftermathResponse {
  attendance_estimate?: number | null;
  narrative?: string;
  chants?: string[];
  key_moments?: string[];
  outcome?: string;
  images_found?: string[];
  videos_found?: string[];
}

export function sanitizeAiResponse(
  raw: unknown,
  scraped: ScrapedArticle[],
): AftermathData {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as AiAftermathResponse;

  const attendance =
    typeof r.attendance_estimate === "number" && r.attendance_estimate >= 0 && r.attendance_estimate < 10_000_000
      ? Math.round(r.attendance_estimate)
      : null;

  const narrative = typeof r.narrative === "string" ? r.narrative.trim().slice(0, 8000) : "";
  const outcome = typeof r.outcome === "string" ? r.outcome.trim().slice(0, 4000) : "";

  const chants = Array.isArray(r.chants)
    ? r.chants
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 280))
        .slice(0, 12)
    : [];

  const key_moments = Array.isArray(r.key_moments)
    ? r.key_moments
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 400))
        .slice(0, 8)
    : [];

  // Images: combine AI-found with OG images from scraped sources, dedup.
  const aiImages = Array.isArray(r.images_found)
    ? r.images_found.filter((x): x is string => typeof x === "string" && /^https?:\/\//.test(x))
    : [];
  const ogImages = scraped.map((s) => s.ogImage).filter((x): x is string => !!x);
  const allImages = Array.from(new Set([...ogImages, ...aiImages])).slice(0, 12);
  const images: AftermathImage[] = allImages.map((url) => ({ url }));

  const aiVideos = Array.isArray(r.videos_found)
    ? r.videos_found.filter((x): x is string => typeof x === "string" && /^https?:\/\//.test(x))
    : [];
  const videos: AftermathVideo[] = Array.from(new Set(aiVideos))
    .slice(0, 8)
    .map((url) => ({ url, source: detectVideoSource(url) }));

  // Sources: from scraped articles (those with ok=true and a title).
  const sources: AftermathSource[] = scraped
    .filter((s) => s.ok && s.title)
    .map((s) => ({
      url: s.url,
      title: s.title ?? undefined,
      publication: s.publication ?? undefined,
      snippet: s.body ? s.body.slice(0, 280) : undefined,
    }))
    .slice(0, 15);

  return {
    attendance_estimate: attendance,
    narrative,
    chants,
    key_moments,
    outcome,
    images,
    videos,
    sources,
  };
}

function detectVideoSource(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h.includes("youtube.com") || h === "youtu.be") return "youtube";
    if (h.includes("tiktok.com")) return "tiktok";
    if (h.includes("instagram.com")) return "instagram";
    if (h.includes("facebook.com") || h.includes("fb.watch")) return "facebook";
    return "direct";
  } catch {
    return "direct";
  }
}
