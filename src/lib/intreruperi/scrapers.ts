/**
 * Scrapers for utility-outage announcements across Romania.
 *
 * Each scraper is independent + best-effort: if a source goes WAF-dark
 * it returns an empty array, the others keep running, and the next 6h
 * cron tick retries. We never throw — partial coverage > total failure.
 *
 * SOURCES (all fan-out in parallel via scrapeAllSources):
 *   - PMB JSON API (api.pmb.ro)                       — plain JSON, reliable
 *   - Apa Nova București (apanovabucuresti.ro)        — HTML, CF best-effort
 *   - Termoenergetica (termoenergetica.ro)            — HTML, "Termo Alert"
 *                                                       data; CF best-effort
 *   - RAJA Constanța (rajac.ro)                       — HTML, often open
 *   - Aquatim Timișoara (aquatim.ro)                  — HTML, often open
 *   - Apavital Iași (apavital.ro)                     — HTML, often open
 *   - DELGAZ Grid (delgaz.ro)                         — HTML
 *   - DEER (distributie.ro / e-distributie.com)       — HTML
 *   - News-derived (stiri_cache table in Supabase)    — surfaces outages
 *                                                       announced via local
 *                                                       press when the
 *                                                       direct site is dark
 *
 * For sources still blocked even with browser headers we'd need a
 * headless browser (Playwright via Browserless.io / Bright Data — paid).
 * The news-derived source partly compensates: if Apa Nova publishes an
 * outage and Digi24 / HotNews / B365 picks it up, we still catch it.
 */

import type { Interruption } from "@/data/intreruperi";

// Real-browser User-Agent so non-WAF endpoints don't 403 us as a bot
// AND so apanovabucuresti.ro's Cloudflare challenge sometimes lets us
// through with a Browser Integrity Check pass.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

// ─── Shared helpers ─────────────────────────────────────────────────

function classifyType(text: string): Interruption["type"] {
  const t = text.toLowerCase();
  // Order matters: "apă caldă" / "termoficare" → caldura first, so a
  // hot-water outage doesn't get tagged as plain water. Then plain
  // water, then gas, then electric, then street works.
  if (/\bcaldur[aă]\b|termoficare|agent termic|magistral|ap[aă] cald/i.test(t))
    return "caldura";
  if (/\bapa\b|\bapă\b|\bapei\b|potabil|conduct.*apa|r[eâ]ut.*apa/i.test(t))
    return "apa";
  if (/\bgaz\b|distrig/i.test(t)) return "gaz";
  if (/\bcurent\b|electric|e-distribu|en\.?l\b/i.test(t)) return "electricitate";
  if (/traf|carosabil|asfalt|strad|b-dul|șos\.|închider|restric/i.test(t))
    return "lucrari-strazi";
  return "altele";
}

function parseRoDate(input: string): Date | null {
  const m = String(input).match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!m) return null;
  // 06:00 UTC ≈ 08:00–09:00 local (matches typical workday start in
  // utility announcements)
  return new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!, 6, 0, 0));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x?\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function extractAddresses(text: string): string[] {
  const out: string[] = [];
  const re =
    /((?:Str\.|Bd\.|B-dul|Bulevardul|Calea|[SȘ]os\.|[SȘ]oseaua|Aleea|Pia[țt]a|Drumul)[^,;.]*?)(?:[,;.]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const addr = m[1]!.trim().replace(/\s+/g, " ");
    if (addr.length > 5 && addr.length < 120 && !out.includes(addr)) {
      out.push(addr);
    }
  }
  return out.slice(0, 12);
}

function extractPdfLinks(html: string): string[] {
  const out: string[] = [];
  const re = /href=["']([^"']+\.pdf[^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let url = m[1]!.trim();
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/") && url.includes("doc.pmb.ro"))
      url = "https:/" + url;
    else if (url.startsWith("/")) url = "https://www.pmb.ro" + url;
    else if (!/^https?:/.test(url)) url = "https://" + url;
    url = url.replace(/^http:\/\/(doc|www|api)\.pmb\.ro/, "https://$1.pmb.ro");
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

// ─── PMB scraper ────────────────────────────────────────────────────

const PMB_ENDPOINT =
  "https://api.pmb.ro/api/get-public-interest-announcements";

const PMB_KEYWORDS = [
  "apa", "apă", "apei", "caldura", "căldură", "gaz",
  "curent", "electric", "trafic", "carosabil", "asfalt",
  "intrerup", "întrerup", "lucrar", "lucrări", "inchid",
  "închid", "restric", "avarie", "magistral", "conduct",
];

const PMB_BLACKLIST = [
  "achizi", "contract", "licita", "angaja", "raport",
  "declara", "buget", "proiect de hot", "hcl ", "hcgmb",
];

interface PmbEntry {
  id: number;
  title?: string;
  description?: string;
  short_description?: string;
  release_date?: string;
  created_at?: string;
}

interface PmbPage {
  data?: PmbEntry[];
  meta?: { last_page?: number };
}

function isPmbRelevant(title: string, description: string): boolean {
  const text = `${title} ${stripHtml(description)}`.toLowerCase();
  if (PMB_BLACKLIST.some((w) => text.includes(w))) return false;
  return PMB_KEYWORDS.some((w) => text.includes(w));
}

function transformPmb(entry: PmbEntry): Interruption | null {
  const descriptionPlain = stripHtml(entry.description ?? "");
  const pdfs = extractPdfLinks(entry.description ?? "");
  const releaseDate =
    parseRoDate(entry.release_date ?? "") ??
    new Date(entry.release_date ?? entry.created_at ?? Date.now());
  if (Number.isNaN(releaseDate.getTime())) return null;

  let endAt = new Date(releaseDate);
  endAt.setDate(endAt.getDate() + 7);
  const durMatch = descriptionPlain.match(/(\d+)\s*zile/i);
  if (durMatch) {
    endAt = new Date(releaseDate);
    endAt.setDate(endAt.getDate() + Math.min(90, +durMatch[1]!));
  }

  const type = classifyType(`${entry.title} ${descriptionPlain}`);
  const addresses = extractAddresses(`${entry.title} ${descriptionPlain}`);
  if (addresses.length === 0) addresses.push("București (zonă nespecificată)");

  const slug = slugify(`pmb-${(entry.title ?? "").slice(0, 40)}`);
  const id = `pmb-${entry.id}-${slug}`;

  return {
    id,
    externalId: `pmb-${entry.id}`,
    type,
    status: endAt > new Date() ? "programat" : "finalizat",
    provider: "Primăria Municipiului București",
    sourceUrl: "https://www.pmb.ro/anunturi-lucrari",
    sourceEntryUrl: pdfs[0],
    sourceEntryTitle: entry.title?.slice(0, 200),
    reason: entry.title?.slice(0, 200) ?? "Anunț PMB",
    addresses,
    county: "B",
    locality: "București",
    startAt: releaseDate.toISOString(),
    endAt: endAt.toISOString(),
    excerpt:
      descriptionPlain.length > 250
        ? descriptionPlain.slice(0, 247) + "..."
        : descriptionPlain || entry.short_description || undefined,
  };
}

export async function scrapePmb(): Promise<Interruption[]> {
  const out: Interruption[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 5; page++) {
    let json: PmbPage;
    try {
      const res = await fetch(`${PMB_ENDPOINT}?sort=-release_date&page=${page}`, {
        headers: { ...BROWSER_HEADERS, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) break;
      json = (await res.json()) as PmbPage;
    } catch {
      break;
    }
    const entries = json.data ?? [];
    if (entries.length === 0) break;
    for (const e of entries) {
      const title = e.title ?? "";
      const desc = e.description ?? "";
      if (!isPmbRelevant(title, desc)) continue;
      const t = transformPmb(e);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    if (json.meta?.last_page && page >= json.meta.last_page) break;
  }
  return out;
}

// ─── Apa Nova scraper (best-effort — Cloudflare may block) ──────────

export async function scrapeApaNova(): Promise<Interruption[]> {
  let html: string;
  try {
    const res = await fetch("https://apanovabucuresti.ro/intreruperi", {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    // Cloudflare returns 403 / 503 with a challenge page when it
    // decides we look like a bot. In that case bail silently — the
    // existing data stays in Supabase, the cron will retry in 6h.
    if (!res.ok) return [];
    const text = await res.text();
    if (text.includes("Just a moment") || text.includes("cf-challenge")) {
      return [];
    }
    html = text;
  } catch {
    return [];
  }

  // Apa Nova publishes outages as `<article>` blocks with a date,
  // a title, and an address list. We extract loosely — the page can
  // change shape and we'd rather drop a row than crash.
  const articles = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
  const out: Interruption[] = [];
  for (const art of articles) {
    const title =
      stripHtml(art.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i)?.[1] ?? "").trim();
    const body = stripHtml(art);
    if (title.length < 5) continue;
    const dateMatch = body.match(
      /(\d{1,2})\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})/i,
    );
    let startAt = new Date();
    if (dateMatch) {
      const months: Record<string, number> = {
        ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
        iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
      };
      const m = months[dateMatch[2]!.toLowerCase()];
      if (m !== undefined) {
        startAt = new Date(Date.UTC(+dateMatch[3]!, m, +dateMatch[1]!, 6, 0));
      }
    }
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 12);

    const addresses = extractAddresses(body);
    if (addresses.length === 0) continue;

    const id = `apanova-${slugify(title)}-${startAt.toISOString().slice(0, 10)}`;
    out.push({
      id,
      externalId: id,
      type: "apa",
      status: endAt > new Date() ? "programat" : "finalizat",
      provider: "Apa Nova București",
      sourceUrl: "https://apanovabucuresti.ro/intreruperi",
      sourceEntryTitle: title.slice(0, 200),
      reason: title.slice(0, 200),
      addresses,
      county: "B",
      locality: "București",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      excerpt: body.slice(0, 200),
    });
  }
  return out;
}

// ─── Termoenergetica (CMTEB) scraper ────────────────────────────────
//
// Compania Municipală Termoenergetica București — the company's
// official site is cmteb.ro (NOT termoenergetica.ro, which we used
// to try; that domain redirects / 404s). Real notices posted on
// apartment buildings cite cmteb.ro as the canonical URL. We try
// the most likely paths for both planned interruptions and active
// failures. Cloudflare may still block a fraction of requests; the
// scraper degrades silently and the cron retries.

const TERMO_URLS = [
  "https://www.cmteb.ro/intreruperi-planificate.php",
  "https://www.cmteb.ro/intreruperi.php",
  "https://www.cmteb.ro/avarii.php",
  "https://www.cmteb.ro/",
];

export async function scrapeTermoenergetica(): Promise<Interruption[]> {
  const out: Interruption[] = [];
  const seen = new Set<string>();

  for (const url of TERMO_URLS) {
    let html: string;
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes("Just a moment") || text.includes("cf-challenge")) {
        continue;
      }
      html = text;
    } catch {
      continue;
    }

    const isPlanned = url.includes("intreruperi-planificate");
    const status: Interruption["status"] = isPlanned ? "programat" : "in-desfasurare";

    // Termoenergetica typically wraps each entry in a <tr> or <article>.
    // Match both — whichever matches non-zero wins, and we extract the
    // visible cells / paragraphs.
    const blocks =
      html.match(/<tr[\s\S]*?<\/tr>/g) ??
      html.match(/<article[\s\S]*?<\/article>/g) ??
      [];

    for (const block of blocks) {
      const text = stripHtml(block);
      if (text.length < 20) continue;
      if (!/strad|adres|sector|bloc|nr\.|str\./i.test(text)) continue; // skip header rows

      // Try to extract a date — Termoenergetica usually shows "DD.MM.YYYY"
      // for the start, sometimes followed by " - DD.MM.YYYY" for the end.
      const dateRange = text.match(
        /(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*(?:[-–]\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4}))?/,
      );
      let startAt = new Date();
      let endAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      if (dateRange) {
        startAt = new Date(
          Date.UTC(+dateRange[3]!, +dateRange[2]! - 1, +dateRange[1]!, 6, 0),
        );
        if (dateRange[4]) {
          endAt = new Date(
            Date.UTC(+dateRange[6]!, +dateRange[5]! - 1, +dateRange[4]!, 18, 0),
          );
        } else {
          endAt = new Date(startAt);
          endAt.setHours(endAt.getHours() + 24);
        }
      }

      // Sector hint (Bucharest only)
      const sectorMatch = text.match(/sector(?:ul)?\s*(\d)/i);
      const sector = sectorMatch ? `S${sectorMatch[1]}` : undefined;

      const addresses = extractAddresses(text);
      if (addresses.length === 0) continue;

      const reason = isPlanned
        ? "Întrerupere planificată — Termoenergetica"
        : "Avarie rețea termică — Termoenergetica";
      const id = `termo-${slugify(`${reason}-${addresses[0]}-${startAt.toISOString().slice(0, 10)}`)}`;
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        id,
        externalId: id,
        type: "caldura",
        status,
        provider: "Termoenergetica (CMTEB)",
        sourceUrl: url,
        reason,
        addresses,
        county: "B",
        locality: "București",
        sector,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excerpt:
          text.length > 220 ? text.slice(0, 217) + "..." : text,
      });
    }
  }

  return out;
}

// ─── Generic "list page → entries" scrapers ─────────────────────────
// Many regional water/gas operators publish outages on a single HTML
// page that lists entries with a date + address block. The pattern is
// stable enough that one helper covers them all — pass the URL, the
// county/provider metadata, and an optional regex hint for the entry
// containers, get back Interruption[].

interface SimpleSiteOpts {
  url: string;
  provider: string;
  county: string;
  locality: string;
  type: Interruption["type"];
  /** Element type to slice into entries. Default: article|tr|li. */
  entrySelector?: RegExp;
  /** Override the default reason text. */
  reasonHint?: string;
}

async function scrapeSimpleListPage(opts: SimpleSiteOpts): Promise<Interruption[]> {
  let html: string;
  try {
    const res = await fetch(opts.url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (text.includes("Just a moment") || text.includes("cf-challenge")) return [];
    html = text;
  } catch {
    return [];
  }

  const re =
    opts.entrySelector ??
    /<(?:article|tr|li|div\s+class=["'][^"']*(?:avari|intrerup|item|card)[^"']*["'])[\s\S]*?<\/(?:article|tr|li|div)>/gi;
  const entries = html.match(re) ?? [];
  const out: Interruption[] = [];
  const seen = new Set<string>();

  for (const block of entries) {
    const body = stripHtml(block);
    if (body.length < 20) continue;
    const addresses = extractAddresses(body);
    if (addresses.length === 0) continue;

    // Date — try DD.MM.YYYY first, then DD luna YYYY (Romanian month name)
    let startAt = new Date();
    const dateMatch = body.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (dateMatch) {
      startAt = new Date(
        Date.UTC(+dateMatch[3]!, +dateMatch[2]! - 1, +dateMatch[1]!, 6, 0),
      );
    } else {
      const roMonth = body.match(
        /(\d{1,2})\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})/i,
      );
      if (roMonth) {
        const months: Record<string, number> = {
          ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
          iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
        };
        const m = months[roMonth[2]!.toLowerCase()];
        if (m !== undefined) {
          startAt = new Date(Date.UTC(+roMonth[3]!, m, +roMonth[1]!, 6, 0));
        }
      }
    }

    // Default end = same day + 12h (most outages are intra-day). Bumped
    // when the body explicitly mentions duration ("48 ore", "3 zile").
    let endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 12);
    const hourDur = body.match(/(\d+)\s*(?:ore|h)\b/i);
    if (hourDur) {
      endAt = new Date(startAt);
      endAt.setHours(endAt.getHours() + Math.min(168, +hourDur[1]!));
    }
    const dayDur = body.match(/(\d+)\s*zile?\b/i);
    if (dayDur) {
      endAt = new Date(startAt);
      endAt.setDate(endAt.getDate() + Math.min(30, +dayDur[1]!));
    }

    const reason = opts.reasonHint ?? `Întrerupere ${opts.type} — ${opts.provider}`;
    const id = `${slugify(opts.provider)}-${slugify(`${reason}-${addresses[0]}-${startAt.toISOString().slice(0, 10)}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      externalId: id,
      type: opts.type,
      status: endAt > new Date() ? "programat" : "finalizat",
      provider: opts.provider,
      sourceUrl: opts.url,
      reason,
      addresses,
      county: opts.county,
      locality: opts.locality,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      excerpt: body.length > 220 ? body.slice(0, 217) + "..." : body,
    });
  }
  return out;
}

export async function scrapeRaja(): Promise<Interruption[]> {
  return scrapeSimpleListPage({
    url: "https://www.rajac.ro/avarii/",
    provider: "RAJA Constanța",
    county: "CT",
    locality: "Constanța",
    type: "apa",
    reasonHint: "Avarie / lucrări rețea apă — RAJA",
  });
}

export async function scrapeAquatim(): Promise<Interruption[]> {
  return scrapeSimpleListPage({
    url: "https://www.aquatim.ro/avarii-curente/",
    provider: "Aquatim Timișoara",
    county: "TM",
    locality: "Timișoara",
    type: "apa",
    reasonHint: "Avarie / lucrări rețea apă — Aquatim",
  });
}

export async function scrapeApavital(): Promise<Interruption[]> {
  return scrapeSimpleListPage({
    url: "https://www.apavital.ro/intreruperi/",
    provider: "Apavital Iași",
    county: "IS",
    locality: "Iași",
    type: "apa",
    reasonHint: "Întrerupere apă — Apavital",
  });
}

export async function scrapeCASom(): Promise<Interruption[]> {
  return scrapeSimpleListPage({
    url: "https://www.casomes.ro/intreruperi-furnizare-apa/",
    provider: "Compania de Apă Someș Cluj",
    county: "CJ",
    locality: "Cluj-Napoca",
    type: "apa",
    reasonHint: "Întrerupere apă — Cluj/Someș",
  });
}

export async function scrapeDelgazGrid(): Promise<Interruption[]> {
  // DELGAZ Grid covers gas + electric across half of RO. Their public
  // notification page lives on delgaz.ro; we extract heating- and gas-
  // related entries. Type defaults to gaz; the entry copy disambiguates.
  return scrapeSimpleListPage({
    url: "https://www.delgaz.ro/comunicate-presa/",
    provider: "DELGAZ Grid",
    county: "MS", // Multi-county; tagged as MS (HQ) for now — county filter
    locality: "Mureș",
    type: "gaz",
    reasonHint: "Întrerupere gaz / electricitate — DELGAZ",
  });
}

export async function scrapeDistributieMuntenia(): Promise<Interruption[]> {
  // E-Distribuție Muntenia lists planned outages by date. The page
  // historically uses Cloudflare; we still try, gracefully zero out.
  return scrapeSimpleListPage({
    url: "https://www.e-distributie.com/clienti/lucrari-planificate.html",
    provider: "E-Distribuție Muntenia",
    county: "B",
    locality: "București",
    type: "electricitate",
    reasonHint: "Lucrări planificate — E-Distribuție",
  });
}

// ─── DEER — Distribuție Energie Electrică Romania ───────────────────
//
// DEER (subsidiar Electrica) acoperă Transilvania Sud + Nord +
// Muntenia Nord. Site oficial: distributie-energie.ro. Pagina
// `intreruperi-programate` listează lucrări programate per județ.
// Multi-county provider — county per row depinde de adresă; păstrăm
// ca fallback "AB" (HQ Alba) pentru entry-urile fără hint, dar
// extragem cod județ din text când posibil.

const DEER_COUNTY_HINT_RE =
  /\b(Alba|Bra[șs]ov|Cluj|Sibiu|Mure[șs]|Hunedoara|Bistri[țt]a|S[ăa]laj|Maramure[șs]|Satu Mare|Bihor|Harghita|Covasna|Bac[ăa]u|Boto[șs]ani|Suceava|Neam[țt]|Ia[șs]i|Vaslui|Vrancea|Gala[țt]i|Br[ăa]ila|Buz[ăa]u|Dâmbovi[țt]a|Prahova|Arge[șs]|Teleorman|Giurgiu|C[ăa]l[ăa]ra[șs]i|Ialomi[țt]a|Constan[țt]a|Tulcea)\b/i;

const COUNTY_NAME_TO_CODE: Record<string, string> = {
  alba: "AB", brasov: "BV", brașov: "BV", cluj: "CJ", sibiu: "SB",
  mures: "MS", mureș: "MS", hunedoara: "HD", bistrita: "BN", bistrița: "BN",
  salaj: "SJ", sălaj: "SJ", maramures: "MM", maramureș: "MM",
  "satu mare": "SM", bihor: "BH", harghita: "HR", covasna: "CV",
  bacau: "BC", bacău: "BC", botosani: "BT", botoșani: "BT",
  suceava: "SV", neamt: "NT", neamț: "NT", iasi: "IS", iași: "IS",
  vaslui: "VS", vrancea: "VN", galati: "GL", galați: "GL",
  braila: "BR", brăila: "BR", buzau: "BZ", buzău: "BZ",
  dambovita: "DB", dâmbovița: "DB", prahova: "PH", arges: "AG", argeș: "AG",
  teleorman: "TR", giurgiu: "GR", calarasi: "CL", călărași: "CL",
  ialomita: "IL", ialomița: "IL", constanta: "CT", constanța: "CT",
  tulcea: "TL", dolj: "DJ", mehedinti: "MH", mehedinți: "MH",
  olt: "OT", valcea: "VL", vâlcea: "VL", gorj: "GJ",
  arad: "AR", caras: "CS", caraș: "CS", "caraș-severin": "CS", timis: "TM", timiș: "TM",
};

function extractCountyFromText(text: string, fallback: string): string {
  const m = text.match(DEER_COUNTY_HINT_RE);
  if (m) {
    const code = COUNTY_NAME_TO_CODE[m[1]!.toLowerCase()];
    if (code) return code;
  }
  return fallback;
}

export async function scrapeDEER(): Promise<Interruption[]> {
  // DEER publică multiple sub-pagini pentru zonele lor de operare.
  // Încercăm URL-urile cunoscute; dacă vreuna pică, restul continuă.
  const DEER_URLS = [
    "https://www.distributie-energie.ro/intreruperi-programate/",
    "https://www.distributie-energie.ro/intreruperi-programate-transilvania-sud/",
    "https://www.distributie-energie.ro/intreruperi-programate-transilvania-nord/",
    "https://www.distributie-energie.ro/intreruperi-programate-muntenia-nord/",
  ];
  const out: Interruption[] = [];
  const seen = new Set<string>();

  for (const url of DEER_URLS) {
    let html: string;
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes("Just a moment") || text.includes("cf-challenge")) continue;
      html = text;
    } catch {
      continue;
    }

    // DEER folosește tabele cu coloane: Județ, Localitate, Adresă, Data,
    // Interval orar, Motiv. Extragem fiecare <tr> cu min 4 celule.
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rows) {
      const text = stripHtml(row);
      if (text.length < 30) continue;
      // Skip header rows (au cuvinte gen "Județ" sau "Adresă" fără număr)
      if (/^(jude|locali|adres|data|interval|motiv)\s/i.test(text)) continue;
      if (!/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.test(text)) continue;

      const dateMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      const startAt = parseRoDate(dateMatch?.[0] ?? "") ?? new Date();
      const endAt = new Date(startAt);
      // Default interval pentru lucrări planificate: 8h (08:00-16:00 local).
      // Citim interval explicit dacă apare ("08:00-16:00")
      const hourRange = text.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
      if (hourRange) {
        startAt.setUTCHours(+hourRange[1]! - 3, +hourRange[2]!); // -3 = UTC offset RO
        endAt.setTime(startAt.getTime());
        endAt.setUTCHours(+hourRange[3]! - 3, +hourRange[4]!);
      } else {
        endAt.setHours(endAt.getHours() + 8);
      }

      const addresses = extractAddresses(text);
      if (addresses.length === 0) {
        // DEER pune adesea „Localitatea X, str. Y" — fallback simplificat
        const localityMatch = text.match(/^([A-ZȘȚÂÎĂ][a-zșțâîă\s-]{3,40})/);
        if (localityMatch) addresses.push(localityMatch[1]!.trim());
        else continue;
      }

      const county = extractCountyFromText(text, "AB");
      const id = `deer-${slugify(`${addresses[0]}-${startAt.toISOString().slice(0, 10)}-${(text.match(/\d+/) ?? ["x"])[0]}`)}`;
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        id,
        externalId: id,
        type: "electricitate",
        status: endAt > new Date() ? "programat" : "finalizat",
        provider: "DEER (Distribuție Energie Electrică Romania)",
        sourceUrl: url,
        reason: "Lucrări planificate — DEER",
        addresses,
        county,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excerpt: text.length > 220 ? text.slice(0, 217) + "..." : text,
      });
    }
  }
  return out;
}

// ─── Distribuție Oltenia ────────────────────────────────────────────
//
// Acoperă Dolj, Mehedinți, Olt, Vâlcea, Gorj, Argeș, Teleorman.
// Site: distributieoltenia.ro. Pagina „lucrari-planificate" listează
// întreruperile pe județ + localitate + adresă + interval orar.

export async function scrapeDistributieOltenia(): Promise<Interruption[]> {
  const OLTENIA_URLS = [
    "https://www.distributieoltenia.ro/ro/intreruperi-planificate",
    "https://www.distributieoltenia.ro/ro/intreruperi/intreruperi-planificate",
  ];
  const out: Interruption[] = [];
  const seen = new Set<string>();

  for (const url of OLTENIA_URLS) {
    let html: string;
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes("Just a moment") || text.includes("cf-challenge")) continue;
      html = text;
    } catch {
      continue;
    }

    // Oltenia folosește layout cu blocuri de articole/items per județ
    const blocks =
      html.match(/<(?:tr|article|li|div\s+class=["'][^"']*(?:lucrar|intrerup|item)[^"']*["'])[\s\S]*?<\/(?:tr|article|li|div)>/gi) ?? [];

    for (const block of blocks) {
      const text = stripHtml(block);
      if (text.length < 30) continue;
      if (/^(jude|locali|adres|data|interval|motiv)\s/i.test(text)) continue;
      if (!/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.test(text)) continue;

      const dateMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      const startAt = parseRoDate(dateMatch?.[0] ?? "") ?? new Date();
      const endAt = new Date(startAt);

      const hourRange = text.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
      if (hourRange) {
        startAt.setUTCHours(+hourRange[1]! - 3, +hourRange[2]!);
        endAt.setTime(startAt.getTime());
        endAt.setUTCHours(+hourRange[3]! - 3, +hourRange[4]!);
      } else {
        endAt.setHours(endAt.getHours() + 8);
      }

      const addresses = extractAddresses(text);
      if (addresses.length === 0) {
        const localityMatch = text.match(/^([A-ZȘȚÂÎĂ][a-zșțâîă\s-]{3,40})/);
        if (localityMatch) addresses.push(localityMatch[1]!.trim());
        else continue;
      }

      // Default DJ (Dolj — HQ Craiova) dacă nu se identifică altul.
      const county = extractCountyFromText(text, "DJ");
      const id = `oltenia-${slugify(`${addresses[0]}-${startAt.toISOString().slice(0, 10)}-${(text.match(/\d+/) ?? ["x"])[0]}`)}`;
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        id,
        externalId: id,
        type: "electricitate",
        status: endAt > new Date() ? "programat" : "finalizat",
        provider: "Distribuție Energie Oltenia",
        sourceUrl: url,
        reason: "Lucrări planificate — Distribuție Oltenia",
        addresses,
        county,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excerpt: text.length > 220 ? text.slice(0, 217) + "..." : text,
      });
    }
  }
  return out;
}

// ─── Rețele Electrice România (rebrand din Enel/E-Distribuție) ──────
//
// În 2024, PPC Group a achiziționat operațiunile Enel din România;
// E-Distribuție Banat / Dobrogea / Muntenia s-au reorganizat sub umbrela
// „Rețele Electrice România" (REE). Site nou: retele-electrice.ro.
// Pagina veche e-distributie.com încă răspunde dar redirect la noul brand
// pentru content-uri noi. Scrape-uim noul URL — dacă pică, vechiul scraper
// scrapeDistributieMuntenia rămâne ca backup.

export async function scrapeReteleElectrice(): Promise<Interruption[]> {
  const RE_URLS = [
    "https://www.retele-electrice.ro/clienti/intreruperi-planificate.html",
    "https://www.retele-electrice.ro/intreruperi-planificate",
    "https://www.retele-electrice.ro/intreruperi",
  ];
  const out: Interruption[] = [];
  const seen = new Set<string>();

  for (const url of RE_URLS) {
    let html: string;
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes("Just a moment") || text.includes("cf-challenge")) continue;
      html = text;
    } catch {
      continue;
    }

    const blocks =
      html.match(/<(?:tr|article|li)[\s\S]*?<\/(?:tr|article|li)>/gi) ?? [];

    for (const block of blocks) {
      const text = stripHtml(block);
      if (text.length < 30) continue;
      if (/^(jude|locali|adres|data|interval|motiv)\s/i.test(text)) continue;
      if (!/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.test(text)) continue;

      const dateMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      const startAt = parseRoDate(dateMatch?.[0] ?? "") ?? new Date();
      const endAt = new Date(startAt);

      const hourRange = text.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
      if (hourRange) {
        startAt.setUTCHours(+hourRange[1]! - 3, +hourRange[2]!);
        endAt.setTime(startAt.getTime());
        endAt.setUTCHours(+hourRange[3]! - 3, +hourRange[4]!);
      } else {
        endAt.setHours(endAt.getHours() + 8);
      }

      const addresses = extractAddresses(text);
      if (addresses.length === 0) continue;

      // Default B (București — REE acoperă Banat/Dobrogea/Muntenia,
      // dar majoritatea entry-urilor sunt din Banat/București).
      const county = extractCountyFromText(text, "B");
      const id = `ree-${slugify(`${addresses[0]}-${startAt.toISOString().slice(0, 10)}-${(text.match(/\d+/) ?? ["x"])[0]}`)}`;
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        id,
        externalId: id,
        type: "electricitate",
        status: endAt > new Date() ? "programat" : "finalizat",
        provider: "Rețele Electrice România",
        sourceUrl: url,
        reason: "Lucrări planificate — Rețele Electrice",
        addresses,
        county,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excerpt: text.length > 220 ? text.slice(0, 217) + "..." : text,
      });
    }
  }
  return out;
}

// ─── News-derived outage source ─────────────────────────────────────
//
// When a utility's website is WAF-dark we can still surface outages
// they announce by parsing our own `stiri_cache` table for outage
// keywords. This catches, for instance, an Apa Nova outage covered by
// Digi24 even when apanovabucuresti.ro returns a Cloudflare challenge
// to our cron's IP. Coverage is not as exhaustive as a direct scrape,
// but it's a strong fallback floor.

import { createSupabaseAdmin } from "@/lib/supabase/admin";

interface StiriRow {
  url: string;
  title: string;
  excerpt: string | null;
  published_at: string;
  counties: string[] | null;
}

// Title-level filter: must announce an outage / interruption / planned
// works. We avoid catching general utility news ("noi tarife apa nova")
// by requiring an action verb + utility keyword.
const NEWS_OUTAGE_RE =
  /\b(?:se opre[sș]te|întrerup|opri[rt]|opre[sș]te furnizarea|f[aă]r[aă] (?:ap[aă]|c[aă]ldur[aă]|gaz|curent)|avarie|lucr[aă]ri (?:de )?(?:reabilitare|moderniza|înlocuir|repara))[^.]{0,80}\b(?:ap[aă]|c[aă]ldur[aă]|gaz|curent|electric|termoficare|magistral)\b/i;

function classifyNewsType(text: string): Interruption["type"] {
  return classifyType(text);
}

export async function scrapeFromNews(): Promise<Interruption[]> {
  const out: Interruption[] = [];
  let rows: StiriRow[] = [];
  try {
    const supabase = createSupabaseAdmin();
    // Last 5 days of articles — outages older than that are stale.
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("stiri_cache")
      .select("url,title,excerpt,published_at,counties")
      .gte("published_at", cutoff)
      .limit(500);
    if (error) return [];
    rows = (data as StiriRow[]) ?? [];
  } catch {
    return [];
  }

  for (const r of rows) {
    const haystack = `${r.title} ${r.excerpt ?? ""}`;
    if (!NEWS_OUTAGE_RE.test(haystack)) continue;

    const type = classifyNewsType(haystack);
    const addresses = extractAddresses(haystack);
    if (addresses.length === 0) {
      // No street-level address → keep but flag as "zonă nespecificată"
      // so users know to read the source. Skip if not even a city is
      // implied (county tag absent).
      const c = r.counties?.[0];
      if (!c) continue;
      addresses.push(`${c} (zonă nespecificată — vezi articolul)`);
    }

    const startAt = new Date(r.published_at);
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 24); // assume same-day; user reads source for exact

    const county = r.counties?.[0]?.toUpperCase() ?? "B";
    const id = `news-${slugify(r.url.slice(-80))}-${startAt.toISOString().slice(0, 10)}`;

    out.push({
      id,
      externalId: id,
      type,
      status: endAt > new Date() ? "programat" : "finalizat",
      provider: "Anunț din presă (Civia)",
      sourceUrl: r.url,
      sourceEntryUrl: r.url,
      sourceEntryTitle: r.title.slice(0, 200),
      reason: r.title.slice(0, 200),
      addresses,
      county,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      excerpt: (r.excerpt ?? r.title).slice(0, 220),
    });
  }
  return out;
}

// ─── Master orchestrator ────────────────────────────────────────────

export interface ScrapeResult {
  items: Interruption[];
  bySource: Record<string, number>;
  errors: string[];
}

export async function scrapeAllSources(): Promise<ScrapeResult> {
  // All 9 sources run in parallel — slowest (or longest-timeout)
  // paces the whole refresh. Each scraper handles its own errors and
  // returns []; nothing should reach Promise.allSettled rejected, but
  // we still defensively handle that path.
  const sources: Array<{ key: string; fn: () => Promise<Interruption[]> }> = [
    // Apă + termoficare + lucrări strazi
    { key: "pmb", fn: scrapePmb },
    { key: "apa-nova", fn: scrapeApaNova },
    { key: "termoenergetica", fn: scrapeTermoenergetica },
    { key: "raja", fn: scrapeRaja },
    { key: "aquatim", fn: scrapeAquatim },
    { key: "apavital", fn: scrapeApavital },
    { key: "ca-somes", fn: scrapeCASom },
    // Energie electrică (4 mari distribuitori naționali) + gaz
    { key: "delgaz", fn: scrapeDelgazGrid },
    { key: "e-distributie", fn: scrapeDistributieMuntenia },
    { key: "retele-electrice", fn: scrapeReteleElectrice },
    { key: "deer", fn: scrapeDEER },
    { key: "distributie-oltenia", fn: scrapeDistributieOltenia },
    // Fallback floor — captează ce sursele directe nu publică
    { key: "news", fn: scrapeFromNews },
  ];

  const settled = await Promise.allSettled(sources.map((s) => s.fn()));

  const items: Interruption[] = [];
  const bySource: Record<string, number> = {};
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const result = settled[i]!;
    if (result.status === "fulfilled") {
      let added = 0;
      for (const it of result.value) {
        if (seenIds.has(it.id)) continue;
        seenIds.add(it.id);
        items.push(it);
        added++;
      }
      bySource[src.key] = added;
    } else {
      bySource[src.key] = 0;
      errors.push(`${src.key}: ${(result.reason as Error).message}`);
    }
  }

  return { items, bySource, errors };
}
