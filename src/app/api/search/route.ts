import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { ghiduri } from "@/data/ghiduri";
import { evenimente } from "@/data/evenimente";
import { ALL_COUNTIES } from "@/data/counties";
import { SESIZARI_GUIDES } from "@/data/sesizari-guides";

// 5 min (de la 1 min) — search results pot fi cached agresiv la edge.
export const revalidate = 300;

interface SearchResult {
  type: "sesizare" | "ghid" | "eveniment" | "stire" | "page" | "judet" | "bilet" | "linie" | "primar" | "directie" | "companie" | "glosar" | "ghid-sesizare" | "transport" | "ai";
  title: string;
  url: string;
  excerpt?: string;
  meta?: string;
}

const STATIC_PAGES: SearchResult[] = [
  // Core platform
  { type: "page", title: "Sesizări", url: "/sesizari", excerpt: "Depune sesizări către autorități" },
  { type: "page", title: "Petiții", url: "/petitii", excerpt: "Petiții civice curate" },
  { type: "page", title: "Proteste", url: "/proteste", excerpt: "Proteste civice anunțate" },
  { type: "page", title: "Întreruperi", url: "/intreruperi", excerpt: "Întreruperi planificate utilități (apă, gaz, curent)" },
  { type: "page", title: "Știri", url: "/stiri", excerpt: "Știri civice din surse verificate" },
  { type: "page", title: "Evenimente", url: "/evenimente", excerpt: "Evenimente majore din România" },
  { type: "page", title: "Ghiduri", url: "/ghiduri", excerpt: "Ghiduri practice pentru cetățeni" },
  { type: "page", title: "Sesizări publice", url: "/sesizari-publice", excerpt: "Ce semnalează alți cetățeni" },
  { type: "page", title: "Urmărește sesizarea", url: "/urmareste", excerpt: "Verifică statusul sesizării tale" },
  { type: "page", title: "Contul tău", url: "/cont", excerpt: "Profil + sesizările tale" },
  { type: "page", title: "Primari București", url: "/b/istoric", excerpt: "Toți primarii Capitalei din 1990 până azi" },

  // Dashboards de date publice
  { type: "page", title: "Siguranță & criminalitate", url: "/siguranta", excerpt: "Statistici oficiale Poliția Română pe tipuri și județe" },
  { type: "page", title: "Educație", url: "/educatie", excerpt: "Promovabilitate BAC, top licee, statistici învățământ" },
  { type: "page", title: "Sănătate", url: "/sanatate", excerpt: "Speranță viață, medici per capita, top spitale publice" },

  // Dev
];

function sanitizeForPostgrest(q: string): string {
  return q.replace(/[,()*.:\\]/g, "").slice(0, 64);
}

/**
 * Normalize diacritics ASCII pentru matching robust.
 * "Țepeș" / "tepes" / "Tepes" → "tepes"
 *
 * Folosit pe AMBELE: query (qRaw) si haystack (titlu+locatie+descriere).
 * Astfel, utilizator care tasteaza "Iancului" fara diacritice gaseste si
 * "Strada Iancului" cu diacritice corecte din DB. Search din analytics
 * (5/8/2026) a aratat 4 search-uri zero-result, posibil din cauza ca
 * utilizatorii tastau fara diacritice text care era stocat cu diacritice.
 */
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // Sedila variants (codepoint diferit de virgulita)
    .replace(/ş/g, "s").replace(/ţ/g, "t");
}

/**
 * Stem a Romanian word by trimming inflection suffixes.
 * "explozie" → "explozi", "rahovei" → "rahov", "incendiul" → "incendi"
 * Returns array of stems to try (original + trimmed variants).
 */
function roStems(word: string): string[] {
  const stems = [word];
  // Romanian suffixes sorted longest-first
  const suffixes = ["ului", "elor", "iei", "rea", "lui", "lor", "iei", "ată", "ate", "ări", "ări", "ul", "ei", "ii", "ea", "le", "or", "al", "ia", "ie", "ă", "a", "e", "i", "u"];
  for (const s of suffixes) {
    if (word.length > s.length + 2 && word.endsWith(s)) {
      stems.push(word.slice(0, -s.length));
      break;
    }
  }
  // Fallback: also try dropping last 1-2 chars for short words
  if (word.length > 4) stems.push(word.slice(0, -1));
  if (word.length > 5) stems.push(word.slice(0, -2));
  return [...new Set(stems)];
}

/** A haystack matches if EVERY query word has at least one stem that appears in it */
function matchesAll(haystack: string, words: string[]): boolean {
  return words.every((w) => {
    const stems = roStems(w);
    return stems.some((s) => haystack.includes(s));
  });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`search:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe căutări. Așteaptă 1 minut." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  // Query original (pentru CTA fallback) + normalizat (pentru matching).
  const qOriginal = (searchParams.get("q") ?? "").trim();
  const qRaw = normalizeForSearch(qOriginal);
  if (!qRaw || qRaw.length < 2) return NextResponse.json({ data: [] });
  const words = qRaw.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return NextResponse.json({ data: [] });

  const results: SearchResult[] = [];

  // Counties / Județe
  for (const c of ALL_COUNTIES) {
    const hay = normalizeForSearch(`${c.name} ${c.id} ${c.slug}`);
    if (matchesAll(hay, words)) {
      results.push({
        type: "judet",
        title: c.name,
        url: `/${c.slug}`,
        excerpt: `Sesizări, calitate aer, știri pentru ${c.name}`,
        meta: c.id,
      });
    }
  }

  // Static pages
  for (const p of STATIC_PAGES) {
    const hay = normalizeForSearch(`${p.title} ${p.excerpt ?? ""}`);
    if (matchesAll(hay, words)) {
      results.push(p);
    }
  }

  // Ghiduri
  for (const g of ghiduri) {
    const hay = normalizeForSearch(`${g.titlu} ${g.descriere}`);
    if (matchesAll(hay, words)) {
      results.push({
        type: "ghid",
        title: g.titlu,
        url: `/ghiduri/${g.slug}`,
        excerpt: g.descriere.slice(0, 120),
      });
    }
  }

  // Evenimente
  for (const e of evenimente) {
    const hay = normalizeForSearch(`${e.titlu} ${e.descriere} ${e.county ?? ""}`);
    if (matchesAll(hay, words)) {
      results.push({
        type: "eveniment",
        title: e.titlu,
        url: `/evenimente/${e.slug}`,
        excerpt: e.descriere.slice(0, 120),
        meta: e.data,
      });
    }
  }

  // Ghiduri sesizări (tipuri de sesizări)
  for (const sg of SESIZARI_GUIDES) {
    const hay = normalizeForSearch([sg.label, sg.urgenta, ...sg.tips, ...sg.destinatari].join(" "));
    if (matchesAll(hay, words)) {
      results.push({
        type: "ghid-sesizare",
        title: `Sesizare: ${sg.label}`,
        url: `/sesizari?tip=${sg.tip}`,
        excerpt: `${sg.urgenta} · Destinatari: ${sg.destinatari.slice(0, 2).join(", ")}`.slice(0, 120),
        meta: sg.tip,
      });
    }
  }

  // Sesizari (DB) — search each word with OR across columns
  try {
    const supabase = await createSupabaseServer();
    const safeWords = words.map((w) => sanitizeForPostgrest(w)).filter(Boolean);
    // Build OR filter: each word must appear in at least one column
    // Supabase doesn't support AND of ORs easily, so we search the first word and filter in JS
    if (safeWords.length > 0) {
      const first = safeWords[0];
      const { data } = await supabase
        .from("sesizari_feed")
        .select("code, titlu, locatie, sector, status, descriere")
        .or(`titlu.ilike.%${first}%,locatie.ilike.%${first}%,descriere.ilike.%${first}%`)
        .limit(20);
      for (const s of (data ?? []) as Array<{ code: string; titlu: string; locatie: string; sector: string; status: string; descriere: string }>) {
        const hay = normalizeForSearch(`${s.titlu} ${s.locatie} ${s.descriere}`);
        if (matchesAll(hay, safeWords)) {
          results.push({
            type: "sesizare",
            title: s.titlu,
            url: `/sesizari/${s.code}`,
            excerpt: `${s.locatie}`,
            meta: s.status,
          });
        }
      }
    }
  } catch { /* ignore */ }

  // Stiri (DB) — same word-based approach
  try {
    const supabase = await createSupabaseServer();
    const safeWords = words.map((w) => sanitizeForPostgrest(w)).filter(Boolean);
    if (safeWords.length > 0) {
      const first = safeWords[0];
      const { data } = await supabase
        .from("stiri_cache")
        .select("id, title, excerpt, source")
        .or(`title.ilike.%${first}%,excerpt.ilike.%${first}%`)
        .order("published_at", { ascending: false })
        .limit(10);
      for (const s of (data ?? []) as Array<{ id: string; title: string; excerpt: string; source: string }>) {
        const hay = normalizeForSearch(`${s.title} ${s.excerpt ?? ""}`);
        if (matchesAll(hay, safeWords)) {
          results.push({
            type: "stire",
            title: s.title,
            url: `/stiri/${s.id}`,
            excerpt: s.excerpt?.slice(0, 120) ?? "",
            meta: s.source,
          });
        }
      }
    }
  } catch { /* ignore */ }

  // Zero-result fallback: daca nu am gasit nimic, oferim CTA spre form-ul
  // de sesizare cu query-ul prefixat. Audit analytics 5/8/2026 a aratat
  // zero-result pe „Iancului", „Soseaua Iancului", „Parteneriat" — locatii
  // sau termeni care NU exista inca in DB-ul de sesizari publice. In loc
  // sa lasam user-ul cu lista goala, ii sugeram sa creeze el sesizarea.
  if (results.length === 0) {
    results.push({
      type: "ai",
      title: `Trimite o sesizare pentru "${qOriginal.slice(0, 60)}"`,
      url: `/sesizari?q=${encodeURIComponent(qOriginal)}`,
      excerpt: "Nu am găsit rezultate. Deschide formul de sesizare cu acest text pre-completat.",
    });
  }

  return NextResponse.json(
    { data: results.slice(0, 30) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
