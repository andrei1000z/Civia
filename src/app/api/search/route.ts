import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { ghiduri } from "@/data/ghiduri";
import { evenimente } from "@/data/evenimente";
import { ALL_COUNTIES } from "@/data/counties";
import { SESIZARI_GUIDES } from "@/data/sesizari-guides";
import { GLOSAR } from "@/data/glosar";
import { PRIMARII, PREFECTURI, ORASE_IMPORTANTE } from "@/data/autoritati-contact";

// 5/23/2026 — Search v2: relevance scoring + petitii + proteste + glosar +
// autoritati + grouping. Cache scurt (60s) pentru rezultate populare.
export const revalidate = 60;

export type SearchResultType =
  | "sesizare"
  | "ghid"
  | "eveniment"
  | "stire"
  | "page"
  | "judet"
  | "petitie"
  | "protest"
  | "glosar"
  | "ghid-sesizare"
  | "autoritate"
  | "ai";

export interface SearchResult {
  type: SearchResultType;
  title: string;
  url: string;
  excerpt?: string;
  meta?: string;
  /** Score 0-100 used to rank results across types. */
  score: number;
  /** UI hint: which group this result belongs to. */
  group: "actiuni" | "navigatie" | "sesizari" | "petitii_proteste" | "stiri_evenimente" | "ghiduri" | "autoritati";
}

const STATIC_PAGES: Omit<SearchResult, "score" | "group">[] = [
  { type: "page", title: "Sesizări", url: "/sesizari", excerpt: "Depune sesizări către autorități cu AI" },
  { type: "page", title: "Petiții", url: "/petitii", excerpt: "Petiții civice curate" },
  { type: "page", title: "Proteste", url: "/proteste", excerpt: "Proteste civice anunțate" },
  { type: "page", title: "Întreruperi planificate", url: "/intreruperi", excerpt: "Întreruperi apă, gaz, curent" },
  { type: "page", title: "Știri civice", url: "/stiri", excerpt: "Știri agregate din surse verificate" },
  { type: "page", title: "Evenimente", url: "/evenimente", excerpt: "Evenimente majore din România" },
  { type: "page", title: "Ghiduri practice", url: "/ghiduri", excerpt: "Ghiduri pas-cu-pas pentru cetățeni" },
  { type: "page", title: "Sesizări publice", url: "/sesizari-publice", excerpt: "Ce semnalează alți cetățeni" },
  { type: "page", title: "Urmărește sesizarea", url: "/urmareste", excerpt: "Verifică statusul sesizării tale" },
  { type: "page", title: "Contul tău", url: "/cont", excerpt: "Profil + sesizările tale" },
  { type: "page", title: "Clasament primării", url: "/clasament-primarii", excerpt: "Rata reală de răspuns a primăriilor" },
  { type: "page", title: "Autorități publice", url: "/autoritati", excerpt: "Catalog primării, prefecturi, poliție" },
];

function sanitizeForPostgrest(q: string): string {
  return q.replace(/[,()*.:\\]/g, "").slice(0, 64);
}

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ş/g, "s")
    .replace(/ţ/g, "t");
}

function roStems(word: string): string[] {
  const stems = [word];
  const suffixes = ["ului", "elor", "iei", "rea", "lui", "lor", "ată", "ate", "ări", "ul", "ei", "ii", "ea", "le", "or", "al", "ia", "ie", "ă", "a", "e", "i", "u"];
  for (const s of suffixes) {
    if (word.length > s.length + 2 && word.endsWith(s)) {
      stems.push(word.slice(0, -s.length));
      break;
    }
  }
  if (word.length > 4) stems.push(word.slice(0, -1));
  if (word.length > 5) stems.push(word.slice(0, -2));
  return [...new Set(stems)];
}

function matchesAll(haystack: string, words: string[]): boolean {
  return words.every((w) => {
    const stems = roStems(w);
    return stems.some((s) => haystack.includes(s));
  });
}

/**
 * Scor de relevanță bazat pe poziția + tipul match-ului.
 * - Match exact pe titlu: +100
 * - Titlu începe cu query: +60
 * - Titlu conține query: +40
 * - Match per cuvânt în titlu: +12 each
 * - Match per cuvânt în excerpt: +4 each
 * - Penalty pentru match doar prin stem fuzzy: -5
 */
function scoreMatch(query: string, words: string[], titleN: string, excerptN: string): number {
  let s = 0;
  if (titleN === query) s += 100;
  if (titleN.startsWith(query)) s += 60;
  else if (titleN.includes(query)) s += 40;
  for (const w of words) {
    if (titleN.includes(w)) s += 12;
    else if (excerptN.includes(w)) s += 4;
    else {
      // Stem fallback
      const stems = roStems(w);
      if (stems.some((st) => titleN.includes(st))) s += 6;
      else if (stems.some((st) => excerptN.includes(st))) s += 2;
      else s -= 1;
    }
  }
  return s;
}

const GROUP_FOR_TYPE: Record<SearchResultType, SearchResult["group"]> = {
  sesizare: "sesizari",
  "ghid-sesizare": "sesizari",
  ghid: "ghiduri",
  glosar: "ghiduri",
  eveniment: "stiri_evenimente",
  stire: "stiri_evenimente",
  petitie: "petitii_proteste",
  protest: "petitii_proteste",
  page: "navigatie",
  judet: "navigatie",
  autoritate: "navigatie",
  ai: "actiuni",
};

function makeResult(
  partial: Omit<SearchResult, "score" | "group">,
  score: number,
): SearchResult {
  return {
    ...partial,
    score,
    group: GROUP_FOR_TYPE[partial.type],
  };
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`search:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe căutări. Așteaptă 1 minut." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const qOriginal = (searchParams.get("q") ?? "").trim();
  const qRaw = normalizeForSearch(qOriginal);
  if (!qRaw || qRaw.length < 2) return NextResponse.json({ data: [] });
  const words = qRaw.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return NextResponse.json({ data: [] });

  const results: SearchResult[] = [];

  // ─── Counties / Județe ────────────────────────────────────────────
  for (const c of ALL_COUNTIES) {
    const titleN = normalizeForSearch(c.name);
    const hayN = normalizeForSearch(`${c.name} ${c.id} ${c.slug}`);
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(c.id + " " + c.slug));
      // Județele primesc bump pentru că sunt entry-point importante
      results.push(makeResult({
        type: "judet",
        title: c.name,
        url: `/${c.slug}`,
        excerpt: `Sesizări, întreruperi, știri pentru ${c.name}`,
        meta: c.id,
      }, s + 25));
    }
  }

  // ─── Static pages ─────────────────────────────────────────────────
  for (const p of STATIC_PAGES) {
    const titleN = normalizeForSearch(p.title);
    const hayN = normalizeForSearch(`${p.title} ${p.excerpt ?? ""}`);
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(p.excerpt ?? ""));
      results.push(makeResult(p, s + 15));
    }
  }

  // ─── Ghiduri statice ──────────────────────────────────────────────
  for (const g of ghiduri) {
    const titleN = normalizeForSearch(g.titlu);
    const hayN = normalizeForSearch(`${g.titlu} ${g.descriere}`);
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(g.descriere));
      results.push(makeResult({
        type: "ghid",
        title: g.titlu,
        url: `/ghiduri/${g.slug}`,
        excerpt: g.descriere.slice(0, 120),
      }, s));
    }
  }

  // ─── Glosar termeni ───────────────────────────────────────────────
  for (const t of GLOSAR) {
    const titleN = normalizeForSearch(t.termen);
    const hayN = normalizeForSearch(`${t.termen} ${t.definitie}`);
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(t.definitie));
      results.push(makeResult({
        type: "glosar",
        title: t.termen,
        url: `/glosar#${t.slug}`,
        excerpt: t.definitie.slice(0, 140),
        meta: t.categorie,
      }, s));
    }
  }

  // ─── Evenimente ───────────────────────────────────────────────────
  for (const e of evenimente) {
    const titleN = normalizeForSearch(e.titlu);
    const hayN = normalizeForSearch(`${e.titlu} ${e.descriere} ${e.county ?? ""}`);
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(e.descriere));
      results.push(makeResult({
        type: "eveniment",
        title: e.titlu,
        url: `/evenimente/${e.slug}`,
        excerpt: e.descriere.slice(0, 120),
        meta: e.data,
      }, s));
    }
  }

  // ─── Ghiduri sesizări ─────────────────────────────────────────────
  for (const sg of SESIZARI_GUIDES) {
    const titleN = normalizeForSearch(sg.label);
    const hayN = normalizeForSearch([sg.label, sg.urgenta, ...sg.tips, ...sg.destinatari].join(" "));
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(sg.urgenta + " " + sg.destinatari.join(" ")));
      results.push(makeResult({
        type: "ghid-sesizare",
        title: `${sg.label}`,
        url: `/sesizari?tip=${sg.tip}`,
        excerpt: `${sg.urgenta} · Către: ${sg.destinatari.slice(0, 2).join(", ")}`.slice(0, 120),
        meta: sg.tip,
      }, s + 8));
    }
  }

  // ─── Autorități: primării reședință + prefecturi (key = county code,
  //     map to county name) + orașe importante (key = slug, value.name) ─
  const authorityCatalog: Array<{ title: string; kind: string; email?: string; url: string }> = [];
  for (const [code, a] of Object.entries(PRIMARII)) {
    const county = ALL_COUNTIES.find((c) => c.id === code);
    if (county) {
      authorityCatalog.push({
        title: `Primăria ${county.name}`,
        kind: "Primărie reședință",
        email: a.email,
        url: `/autoritati`,
      });
    }
  }
  for (const [code, a] of Object.entries(PREFECTURI)) {
    const county = ALL_COUNTIES.find((c) => c.id === code);
    if (county) {
      authorityCatalog.push({
        title: `Prefectura ${county.name}`,
        kind: "Prefectură",
        email: a.email,
        url: `/autoritati`,
      });
    }
  }
  for (const a of Object.values(ORASE_IMPORTANTE)) {
    authorityCatalog.push({
      title: `Primăria ${a.name}`,
      kind: "Primărie oraș",
      email: a.email,
      url: `/autoritati`,
    });
  }
  for (const a of authorityCatalog) {
    const titleN = normalizeForSearch(a.title);
    const hayN = normalizeForSearch(`${a.title} ${a.kind}`);
    if (matchesAll(hayN, words)) {
      const s = scoreMatch(qRaw, words, titleN, normalizeForSearch(a.kind));
      results.push(makeResult({
        type: "autoritate",
        title: a.title,
        url: a.url,
        excerpt: `${a.kind}${a.email ? ` · ${a.email}` : ""}`,
        meta: a.kind,
      }, s));
    }
  }

  // ─── DB: Sesizari + Stiri + Petitii + Proteste (parallel) ──────────
  const supabase = await createSupabaseServer();
  const safeWords = words.map((w) => sanitizeForPostgrest(w)).filter(Boolean);
  const firstWord = safeWords[0];

  if (firstWord) {
    const [sesRes, stiriRes, petitiiRes, protesteRes] = await Promise.all([
      supabase
        .from("sesizari_feed")
        .select("code, titlu, locatie, sector, status, descriere")
        .or(`titlu.ilike.%${firstWord}%,locatie.ilike.%${firstWord}%,descriere.ilike.%${firstWord}%`)
        .limit(20),
      supabase
        .from("stiri_cache")
        .select("id, title, excerpt, source, published_at")
        .or(`title.ilike.%${firstWord}%,excerpt.ilike.%${firstWord}%`)
        .order("published_at", { ascending: false })
        .limit(15),
      supabase
        .from("petitii")
        .select("slug, title, summary, status")
        .or(`title.ilike.%${firstWord}%,summary.ilike.%${firstWord}%`)
        .eq("status", "active")
        .limit(10),
      supabase
        .from("proteste")
        .select("slug, title, subtitle, city, start_at")
        .or(`title.ilike.%${firstWord}%,subtitle.ilike.%${firstWord}%,city.ilike.%${firstWord}%`)
        .eq("moderation_status", "approved")
        .limit(10),
    ]);

    // Sesizari
    for (const r of (sesRes.data ?? []) as Array<{ code: string; titlu: string; locatie: string; descriere: string; status: string }>) {
      const titleN = normalizeForSearch(r.titlu);
      const hayN = normalizeForSearch(`${r.titlu} ${r.locatie} ${r.descriere}`);
      if (matchesAll(hayN, safeWords)) {
        const s = scoreMatch(qRaw, safeWords, titleN, normalizeForSearch(r.locatie + " " + r.descriere));
        results.push(makeResult({
          type: "sesizare",
          title: r.titlu,
          url: `/sesizari/${r.code}`,
          excerpt: r.locatie,
          meta: r.status,
        }, s + 5));
      }
    }

    // Stiri
    for (const r of (stiriRes.data ?? []) as Array<{ id: string; title: string; excerpt: string; source: string }>) {
      const titleN = normalizeForSearch(r.title);
      const hayN = normalizeForSearch(`${r.title} ${r.excerpt ?? ""}`);
      if (matchesAll(hayN, safeWords)) {
        const s = scoreMatch(qRaw, safeWords, titleN, normalizeForSearch(r.excerpt ?? ""));
        results.push(makeResult({
          type: "stire",
          title: r.title,
          url: `/stiri/${r.id}`,
          excerpt: (r.excerpt ?? "").slice(0, 120),
          meta: r.source,
        }, s));
      }
    }

    // Petitii
    for (const r of (petitiiRes.data ?? []) as Array<{ slug: string; title: string; summary: string }>) {
      const titleN = normalizeForSearch(r.title);
      const hayN = normalizeForSearch(`${r.title} ${r.summary ?? ""}`);
      if (matchesAll(hayN, safeWords)) {
        const s = scoreMatch(qRaw, safeWords, titleN, normalizeForSearch(r.summary ?? ""));
        results.push(makeResult({
          type: "petitie",
          title: r.title,
          url: `/petitii/${r.slug}`,
          excerpt: (r.summary ?? "").slice(0, 120),
        }, s + 10));
      }
    }

    // Proteste
    for (const r of (protesteRes.data ?? []) as Array<{ slug: string; title: string; subtitle: string | null; city: string | null; start_at: string }>) {
      const titleN = normalizeForSearch(r.title);
      const hayN = normalizeForSearch(`${r.title} ${r.subtitle ?? ""} ${r.city ?? ""}`);
      if (matchesAll(hayN, safeWords)) {
        const s = scoreMatch(qRaw, safeWords, titleN, normalizeForSearch((r.subtitle ?? "") + " " + (r.city ?? "")));
        const dateStr = r.start_at ? new Date(r.start_at).toLocaleDateString("ro-RO") : "";
        results.push(makeResult({
          type: "protest",
          title: r.title,
          url: `/proteste/${r.slug}`,
          excerpt: [r.city, dateStr].filter(Boolean).join(" · ").slice(0, 120) || (r.subtitle ?? "").slice(0, 120),
        }, s + 10));
      }
    }
  }

  // ─── Sort by score desc, dedupe by URL, cap at 40 ───────────────────
  const seen = new Set<string>();
  const sorted = results
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    })
    .slice(0, 40);

  // ─── Zero-result fallback ──────────────────────────────────────────
  if (sorted.length === 0) {
    sorted.push(makeResult({
      type: "ai",
      title: `Trimite o sesizare despre „${qOriginal.slice(0, 60)}"`,
      url: `/sesizari?q=${encodeURIComponent(qOriginal)}`,
      excerpt: "Nu am găsit rezultate. Deschide formular de sesizare cu acest text pre-completat.",
    }, 100));
  }

  return NextResponse.json(
    { data: sorted },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
