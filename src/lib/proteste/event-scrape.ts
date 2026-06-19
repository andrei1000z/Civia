/**
 * 2026-06-19 — Scraper de EVENIMENT (proteste) cu extragere STRUCTURATĂ.
 *
 * Problema cu AI-only: din og:description (un rezumat subțire) AI-ul halucina
 * data/locația. Realitatea: paginile de eveniment au datele EXACTE embedate —
 * Facebook în JSON-ul de relay (`start_timestamp`, `event_place`,
 * `event_description`), alte site-uri în JSON-LD (`@type: Event`). Le scoatem
 * DETERMINIST (autoritative), iar AI-ul completează doar câmpurile „soft"
 * (cauză, subtitlu, hashtag, revendicări) din descriere — fără să ghicească ora.
 */

const CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;

export interface EventScrape {
  ok: boolean;
  title: string | null;
  description: string | null;
  startIso: string | null;
  endIso: string | null;
  locationName: string | null;
  city: string | null;
  organizer: string | null;
  ogImage: string | null;
  /** Text bogat pt. AI (og:desc + day_time_sentence + descriere). */
  aiText: string;
  error?: string;
}

const EMPTY = (error?: string): EventScrape => ({
  ok: false,
  title: null,
  description: null,
  startIso: null,
  endIso: null,
  locationName: null,
  city: null,
  organizer: null,
  ogImage: null,
  aiText: "",
  error,
});

async function fetchHtml(url: string, ua: string): Promise<{ ok: boolean; html: string; status: number }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.5",
      },
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, html, status: res.status };
  } catch {
    return { ok: false, html: "", status: 0 };
  }
}

function ogMeta(html: string, prop: string): string | null {
  const e = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m =
    html.match(new RegExp(`<meta\\s+(?:property|name)=["']${e}["'][^>]*?content=["']([^"']*)["']`, "i")) ||
    html.match(new RegExp(`<meta\\s+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${e}["']`, "i"));
  return m?.[1] ? decodeHtml(m[1]) : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeCp(parseInt(d, 10)))
    .trim();
}

function safeCp(cp: number): string {
  return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
}

/** Decodează corpul unui string JSON (cu \uXXXX, \n, \", \/) prin JSON.parse. */
function jsonStr(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    return (JSON.parse(`"${raw}"`) as string).trim() || null;
  } catch {
    return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => safeCp(parseInt(h, 16))).replace(/\\n/g, "\n").trim() || null;
  }
}

function firstMatch(html: string, re: RegExp): string | null {
  return html.match(re)?.[1] ?? null;
}

/** Facebook: extrage din JSON-ul de relay embedat în pagină. */
function parseFacebook(html: string): Partial<EventScrape> {
  const out: Partial<EventScrape> = {};
  const startTs = firstMatch(html, /"start_timestamp":\s*(\d{9,12})/);
  const endTs = firstMatch(html, /"end_timestamp":\s*(\d{9,12})/);
  if (startTs) out.startIso = new Date(Number(startTs) * 1000).toISOString();
  if (endTs) out.endIso = new Date(Number(endTs) * 1000).toISOString();

  const venue =
    firstMatch(html, /"event_place":\{[^{}]*?"name":"((?:[^"\\]|\\.)*?)"/) ||
    firstMatch(html, /"contextual_name":"((?:[^"\\]|\\.)*?)"/);
  if (venue) out.locationName = jsonStr(venue);

  const addr = firstMatch(html, /"one_line_address":"((?:[^"\\]|\\.)*?)"/);
  if (addr) {
    const a = jsonStr(addr) ?? "";
    // ultimul segment, fără cod poștal → oraș
    const seg = a.split(",").pop()?.replace(/\d{4,6}/g, "").trim();
    if (seg) out.city = seg;
  }

  const desc = firstMatch(html, /"event_description":\{"text":"((?:[^"\\]|\\.)*?)"/);
  if (desc) out.description = jsonStr(desc);

  const dts = firstMatch(html, /"day_time_sentence":"((?:[^"\\]|\\.)*?)"/);
  if (dts) out.aiText = `Data evenimentului (Facebook): ${jsonStr(dts)}\n`;
  return out;
}

/** JSON-LD generic (@type Event) — site-uri non-FB care îl includ. */
function parseJsonLd(html: string): Partial<EventScrape> {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    const rawLd = b[1];
    if (!rawLd) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawLd.trim());
    } catch {
      continue;
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of arr) {
      const items = node && typeof node === "object" && "@graph" in node ? (node as { "@graph": unknown[] })["@graph"] : [node];
      for (const it of items as Array<Record<string, unknown>>) {
        const type = it?.["@type"];
        const isEvent = typeof type === "string" ? /event/i.test(type) : Array.isArray(type) && type.some((t) => /event/i.test(String(t)));
        if (!isEvent) continue;
        const out: Partial<EventScrape> = {};
        if (typeof it.name === "string") out.title = it.name.trim();
        if (typeof it.startDate === "string" && !Number.isNaN(Date.parse(it.startDate))) out.startIso = new Date(it.startDate).toISOString();
        if (typeof it.endDate === "string" && !Number.isNaN(Date.parse(it.endDate))) out.endIso = new Date(it.endDate).toISOString();
        if (typeof it.description === "string") out.description = it.description.trim();
        const loc = it.location as Record<string, unknown> | undefined;
        if (loc && typeof loc.name === "string") out.locationName = loc.name.trim();
        const addr = loc?.address as Record<string, unknown> | string | undefined;
        if (typeof addr === "string") out.city = addr.split(",")[0]?.trim() ?? null;
        else if (addr && typeof addr.addressLocality === "string") out.city = addr.addressLocality.trim();
        return out;
      }
    }
  }
  return {};
}

export async function scrapeEventPage(url: string): Promise<EventScrape> {
  // FB & multe site-uri „gated" servesc OG + JSON doar la crawler-UA; presa care
  // dă 403 la boți o prindem cu fallback pe Chrome UA.
  let { ok, html } = await fetchHtml(url, CRAWLER_UA);
  if (!ok || html.length < 500) {
    const retry = await fetchHtml(url, CHROME_UA);
    if (retry.ok && retry.html.length > html.length) ({ ok, html } = retry);
  }
  if (!html || html.length < 200) return EMPTY("Nu am putut citi pagina.");

  const title = ogMeta(html, "og:title");
  const ogDesc = ogMeta(html, "og:description");
  const ogImage = ogMeta(html, "og:image");

  const isFb = /facebook\.com|fb\.com|fb\.me/i.test(url);
  const structured = isFb ? parseFacebook(html) : parseJsonLd(html);

  const description = structured.description || ogDesc || null;
  const aiTextParts = [structured.aiText, ogDesc ? `Rezumat (OG): ${ogDesc}` : "", description ? `Descriere:\n${description}` : ""].filter(Boolean);

  const ev: EventScrape = {
    ok: !!(title || description || structured.startIso),
    title: structured.title || title,
    description,
    startIso: structured.startIso ?? null,
    endIso: structured.endIso ?? null,
    locationName: structured.locationName ?? null,
    city: structured.city ?? null,
    organizer: null, // lăsat AI-ului (din text „organizat de X")
    ogImage,
    aiText: aiTextParts.join("\n\n").slice(0, 6000),
  };
  return ev;
}
