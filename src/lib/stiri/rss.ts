import Parser from "rss-parser";
import { detectCounties } from "./county-keywords";

export interface MediaItem {
  type: "image" | "video";
  url: string;
  caption?: string;
  poster?: string;
}

export interface RssArticle {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  source: string;
  category: string;
  author: string | null;
  image_url: string | null;
  published_at: string;
  counties: string[]; // county IDs matched from content
  media: MediaItem[]; // toate pozele + videourile din articol
}

interface Feed {
  url: string;
  source: string;
}

/**
 * RSS feeds. National sources show on /stiri; local houses surface
 * additionally on the matching /[judet]/stiri page (mapping in
 * src/lib/stiri/sources.ts → LOCAL_SOURCES_BY_COUNTY).
 *
 * Source selection criteria (round 2026-05-02 expansion):
 *   - Working RSS verified live (probed via curl)
 *   - Editorial standards we'd want a civic platform associated with
 *     — independent + investigative tier preferred (PressOne,
 *     Recorder, Spotmedia, Europa Liberă) over pure ad-driven feeds
 *   - Local: at least one strong outlet per county that publishes
 *     daily and isn't a partisan party paper
 */
const FEEDS: Feed[] = [
  // ─── NATIONAL — wire-service + investigative ─────────────────
  { url: "https://www.digi24.ro/rss", source: "Digi24" },
  { url: "https://www.hotnews.ro/rss", source: "Hotnews" },
  { url: "https://www.g4media.ro/feed", source: "G4Media" },
  { url: "https://www.mediafax.ro/rss", source: "Mediafax" },
  { url: "https://www.news.ro/rss", source: "News.ro" },
  { url: "https://pressone.ro/api/rss", source: "PressOne" },
  { url: "https://spotmedia.ro/feed", source: "Spotmedia" },
  { url: "https://romania.europalibera.org/api/zomgpe%24qoyq", source: "Europa Liberă" },
  { url: "https://recorder.ro/feed/", source: "Recorder" },
  { url: "https://www.libertatea.ro/feed", source: "Libertatea" },
  { url: "https://adevarul.ro/rss/index", source: "Adevărul" },
  { url: "https://www.gandul.ro/feed", source: "Gândul" },
  { url: "https://www.zf.ro/rss/", source: "Ziarul Financiar" },
  { url: "https://www.editiadedimineata.ro/feed", source: "Ediția de Dimineață" },
  { url: "https://www.stiridinromania.ro/feed", source: "Știri din România" },
  // ─── LOCAL — at least one paper per major county ─────────────
  // Bucharest
  { url: "https://b365.ro/feed/", source: "B365.ro" },
  // Cluj
  { url: "https://www.monitorulcj.ro/rss", source: "Monitorul CJ" },
  { url: "https://www.stiridecluj.ro/rss.xml", source: "Știri de Cluj" },
  { url: "https://www.actualdecluj.ro/feed", source: "Actual de Cluj" },
  // Iași
  { url: "https://www.ziaruldeiasi.ro/rss", source: "Ziarul de Iași" },
  { url: "https://www.bzi.ro/feed", source: "BZI" },
  { url: "https://www.7iasi.ro/feed", source: "7Iași" },
  // Timiș
  { url: "https://www.opiniatimisoarei.ro/feed", source: "Opinia Timișoarei" },
  { url: "https://pressalert.ro/feed", source: "PressAlert" },
  { url: "https://www.tion.ro/feed", source: "TION" },
  // Constanța
  { url: "https://www.telegrafonline.ro/feed", source: "Telegraf" },
  { url: "https://www.ziuaconstanta.ro/feed", source: "Ziua de Constanța" },
  // Alba
  { url: "https://alba24.ro/feed", source: "Alba24" },
  { url: "https://www.ziarulunirea.ro/feed", source: "Ziarul Unirea" },
  // Arad
  { url: "https://www.aradon.ro/feed", source: "Aradon" },
  // Argeș
  { url: "https://www.jurnaluldearges.ro/feed", source: "Jurnalul de Argeș" },
  // Bacău
  { url: "https://www.desteptarea.ro/feed", source: "Deșteptarea" },
  // Bihor
  { url: "https://www.bihon.ro/feed", source: "Bihon" },
  // Bistrița-Năsăud
  { url: "https://www.gazetadebistrita.ro/feed", source: "Gazeta de Bistrița" },
  // Botoșani
  { url: "https://www.monitorulbt.ro/feed", source: "Monitorul BT" },
  // Brăila
  { url: "https://www.obiectivbr.ro/feed", source: "Obiectiv BR" },
  // Brașov
  { url: "https://www.bizbrasov.ro/feed", source: "BizBrașov" },
  // Buzău
  { url: "https://www.opiniabuzau.ro/feed", source: "Opinia Buzău" },
  // Dolj
  { url: "https://www.gds.ro/feed", source: "Gazeta de Sud" },
  // Hunedoara
  { url: "https://www.replicahd.ro/feed", source: "Replica HD" },
  // Maramureș
  { url: "https://www.emaramures.ro/feed", source: "eMaramureș" },
  // Mureș
  { url: "https://www.zi-de-zi.ro/feed", source: "Zi de Zi" },
  // Neamț
  { url: "https://www.monitorulneamt.ro/feed", source: "Monitorul NT" },
  // Prahova
  { url: "https://www.observatorulph.ro/feed", source: "Observatorul PH" },
  // Satu Mare
  { url: "https://www.gsm.ro/feed", source: "Gazeta Nord-Vest" },
  // Sibiu
  { url: "https://www.turnulsfatului.ro/feed", source: "Turnul Sfatului" },
  { url: "https://www.tribuna.ro/feed", source: "Tribuna" },
  // Suceava
  { url: "https://www.monitorulsv.ro/feed", source: "Monitorul SV" },
  { url: "https://www.newsbucovina.ro/feed", source: "News Bucovina" },
  // Vrancea
  { url: "https://www.monitoruldevrancea.ro/feed", source: "Monitorul VN" },
];

/**
 * Detect promotional / advertorial / sponsored content so it stays
 * out of the civic feed. Romanian outlets typically tag these with:
 *   - "(P)" / "[P]" prefix or " P " suffix on the title
 *   - "ADVERTORIAL", "PROMO", "PUBLICITATE", "Sponsorizat" in title
 *   - "/advertorial/", "/promo/", "/publicitate/" path segment in URL
 *   - rare: category="advertorial" in the RSS itself
 *
 * Plus crowd-pleaser fluff that has no civic angle (horoscope,
 * lifestyle puffery, "10 motive de…" listicles) — these aren't
 * paid promo but they're noise. Filtered with a softer pattern.
 */
export function isPromotional(title: string, url: string, category?: string): boolean {
  const t = title.toLowerCase();
  const u = url.toLowerCase();

  // Hard signals — explicitly marked as paid content.
  if (/\(\s*p\s*\)|\[\s*p\s*\]|\badvertorial\b|\bsponsoriz|\bpromo[\s\-:]+|publicitate|reclamă|partener[ie]a|articol\s+plătit/i.test(title)) {
    return true;
  }
  if (/\/(advertorial|promo|publicitate|sponsor[a-z]*|partener[a-z]*|reclam[ae])\//i.test(u)) {
    return true;
  }
  if (category && /^(advertorial|promo|publicitate|sponsor)/i.test(category)) {
    return true;
  }

  // Soft signals — outlet sections that are noise on a civic feed.
  // (horoscope, gossip, recipe, lifestyle clickbait, weather puffery)
  if (/\b(horoscop|zodii|astrolog|reteta|reţeta|rețetă|vedete|gossip|cancan|wow)\b/i.test(t)) {
    return true;
  }
  if (/\/(horoscop|stiri-vedete|monden|gossip|lifestyle|sport|sex)\//i.test(u)) {
    return true;
  }

  return false;
}

// Simple category classifier from keywords in title + excerpt
export function classifyCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/metrou|metrorex|stb|autobuz|tramvai|bilet|abonament|trafic|pasaj|centură|transport public/.test(lower)) return "transport";
  if (/urbanism|pug|puz|construcții|construire|imobiliar|cartier|bloc/.test(lower)) return "urbanism";
  // word-boundary on "parc" / "parcuri" / "parcurile" so "parcare" / "parcaj" don't false-match.
  if (/aer|poluare|\bparc(uri|ul|urile)?\b|verde|copac|mediu|deșeu|salubri|climă/.test(lower)) return "mediu";
  if (/accident|incendiu|poliție|furt|siguranță|violență|jandarm/.test(lower)) return "siguranta";
  if (/primar|consiliu|buget|primărie|pmb|hotărâre|taxe|alegeri|guvern|ministru/.test(lower)) return "administratie";
  if (/festival|concert|protest|manifest|eveniment|paradă/.test(lower)) return "eveniment";
  return "administratie";
}

export function cleanText(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

/**
 * Returns true dacă URL-ul arată ca o imagine validă pentru `<img>`:
 *   - Are extensie de imagine cunoscută (jpg/png/webp/avif/gif), SAU
 *   - NU are extensie de media non-imagine (mp4/webm/mov/mp3/pdf).
 * Folosit ca prim filtru ieftin înainte de fetch HEAD (verificat în
 * fetchOgImage prin content-type sniff). Bug fix 5/23/2026 — Gândul
 * publica „ssstwitter-com_*.mp4" ca <img src=...> în content RSS,
 * pe care îl preluam fără validare → fundal gol pe card.
 */
function looksLikeImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    // Reject hard: known non-image extensions
    if (/\.(mp4|webm|mov|m4v|mp3|wav|ogg|pdf|zip|svgz)(\?|$)/i.test(path)) {
      return false;
    }
    // Accept hard: known image extensions
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/i.test(path)) return true;
    // No extension (CDN paths like /wp-content/uploads/... fără ext, sau
    // resize endpoints `/resize/600x400/foo`) — accept tentative; HEAD
    // check va valida content-type ulterior.
    return true;
  } catch {
    return false;
  }
}

function extractImage(item: { content?: string; enclosure?: { url?: string }; [key: string]: unknown }): string | null {
  const candidates: string[] = [];
  // Try enclosure
  if (item.enclosure?.url) candidates.push(item.enclosure.url);
  // Try media:content
  const mediaContent = item["media:content"] as { $?: { url?: string } } | undefined;
  if (mediaContent?.$?.url) candidates.push(mediaContent.$.url);
  // Try media:thumbnail
  const mediaThumbnail = item["media:thumbnail"] as { $?: { url?: string } } | undefined;
  if (mediaThumbnail?.$?.url) candidates.push(mediaThumbnail.$.url);
  // Try itunes:image
  const itunesImage = item["itunes:image"] as { $?: { href?: string } } | undefined;
  if (itunesImage?.$?.href) candidates.push(itunesImage.$.href);
  // ALL <img> in content (poate primul e logo/spacer, al doilea e real)
  const content = (item.content || "") as string;
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(content)) !== null) {
    if (m[1]) candidates.push(m[1]);
  }
  // og:image din description HTML (rare dar valid)
  const desc = (item["content:encoded"] || item.content || "") as string;
  const ogMatch = desc.match(/og:image[^>]+content=["']([^"']+)["']/);
  if (ogMatch && ogMatch[1]) candidates.push(ogMatch[1]);

  // Returnează primul candidat care arată a imagine (skip mp4/etc).
  for (const c of candidates) {
    if (looksLikeImageUrl(c)) return c;
  }
  return null;
}

export async function fetchFeed(feed: Feed): Promise<RssArticle[]> {
  const parser = new Parser({
    timeout: 15000,
    customFields: {
      item: [
        ["media:content", "media:content"],
        ["media:thumbnail", "media:thumbnail"],
        ["content:encoded", "contentEncoded"],
      ],
    },
  });

  try {
    const result = await parser.parseURL(feed.url);
    const articles: RssArticle[] = [];

    for (const item of result.items ?? []) {
      if (!item.link || !item.title) continue;

      const title = item.title;

      // Drop promo / advertorial / lifestyle fluff before any further
      // processing — saves Groq cycles, DB writes, and avoids polluting
      // the civic feed with paid content. The check is cheap (regex
      // on title + URL + RSS category).
      const itemCategory =
        Array.isArray(item.categories) && item.categories.length > 0
          ? String(item.categories[0])
          : undefined;
      if (isPromotional(title, item.link, itemCategory)) continue;

      const content = cleanText(item["contentEncoded"] as string) || cleanText(item.content) || "";
      const excerpt = cleanText(item.contentSnippet) || content.slice(0, 240);
      const searchText = `${title} ${excerpt}`;

      // Detect counties from article text
      const counties = detectCounties(searchText);

      const itemAny = item as unknown as Record<string, unknown>;
      articles.push({
        url: item.link,
        title,
        excerpt: excerpt.slice(0, 500),
        content: content.slice(0, 2000),
        source: feed.source,
        category: classifyCategory(searchText),
        author: (itemAny.creator as string) || (itemAny.author as string) || null,
        image_url: extractImage(itemAny as { content?: string; enclosure?: { url?: string }; [key: string]: unknown }),
        published_at: item.isoDate || item.pubDate || new Date().toISOString(),
        counties,
        media: [], // populat în fetchAllFeedsWithDiag via fetchArticleMedia()
      });
    }
    return articles;
  } catch (e) {
    console.error(`Failed to fetch ${feed.source}:`, (e as Error).message);
    return [];
  }
}

/**
 * Fetch o imagine valid din pagina articolului. Best-effort, fast timeout.
 * Bug fix 5/23/2026 — local houses (7Iași, Observatorul PH, Monitorul BT, etc.)
 * blocau User-Agent „Civia/1.0" cu 403 / cloudflare challenge. Plus unele
 * paginile nu au og:image dar au twitter:image / first <img>. Acum:
 *   1. UA = Mozilla browser real (mai puține blocaje 403)
 *   2. Multi-selector: og:image → twitter:image → og:image:url → first <img>
 *   3. URL absolut: rezolvă relativ la origin dacă lipsește schema
 *   4. Validare looksLikeImageUrl (skip mp4 din meta if any)
 */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro/about) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Multi-selector în ordine de preferință.
    const selectors: RegExp[] = [
      // og:image / og:image:url / og:image:secure_url
      /<meta[^>]+property=["']og:image(?::(?:url|secure_url))?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::(?:url|secure_url))?["']/i,
      // twitter:image / twitter:image:src
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      // Schema.org image (JSON-LD or itemprop)
      /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
      // Fallback: first <img> with reasonable src
      /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|avif|gif))["']/i,
    ];

    for (const re of selectors) {
      const m = html.match(re);
      const found = m?.[1]?.trim();
      if (!found) continue;
      // Rezolvă URL relativ la pagină (//cdn.foo/img.jpg sau /foo/bar.jpg)
      let abs: string;
      try {
        abs = new URL(found, url).toString();
      } catch {
        continue;
      }
      if (!looksLikeImageUrl(abs)) continue;
      return abs;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch + parse media (toate <img> + <video> + <picture>) din pagina
 * articolului. Best-effort, fast timeout. Dedupes + filtrează miniaturi
 * mici (logo, ads, tracking pixels) prin heuristică pe URL.
 *
 * Returnează maxim 12 media items (cap defensiv pentru UI).
 */
export async function fetchArticleMedia(url: string): Promise<MediaItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CiviaBot/1.0; +https://civia.ro/about) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // 1. Articolul WordPress / Drupal / custom CMS — căutăm container-ul
    //    principal pentru a evita logos / ads din header/footer. Fallback la
    //    întreg HTML dacă nu găsim.
    const articleMatch = html.match(
      /<article[^>]*>([\s\S]*?)<\/article>/i,
    );
    const scope = articleMatch?.[1] ?? html;

    const items: MediaItem[] = [];
    const seen = new Set<string>();

    // 2. Extract <figure> blocks (au caption nativ via <figcaption>)
    const figureRegex =
      /<figure[^>]*>([\s\S]*?)<\/figure>/gi;
    let fm: RegExpExecArray | null;
    while ((fm = figureRegex.exec(scope)) !== null) {
      const block = fm[1] ?? "";
      const imgM = block.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      const captionM = block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
      if (imgM?.[1]) {
        const abs = absUrl(imgM[1], url);
        if (abs && looksLikeImageUrl(abs) && !isLikelyJunkImage(abs) && !seen.has(abs)) {
          seen.add(abs);
          const altM = imgM[0].match(/alt=["']([^"']*)["']/i);
          const cap = captionM?.[1] ? stripTags(captionM[1]) : altM?.[1] ?? undefined;
          items.push({ type: "image", url: abs, caption: cap || undefined });
        }
      }
    }

    // 3. <img> standalone (cele care nu sunt în figure deja procesate)
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRegex.exec(scope)) !== null) {
      const src = im[1];
      if (!src) continue;
      const abs = absUrl(src, url);
      if (!abs || !looksLikeImageUrl(abs) || isLikelyJunkImage(abs) || seen.has(abs)) {
        continue;
      }
      seen.add(abs);
      const altM = im[0].match(/alt=["']([^"']*)["']/i);
      items.push({
        type: "image",
        url: abs,
        caption: altM?.[1] && altM[1].length > 3 ? altM[1] : undefined,
      });
    }

    // 4. <video> tags
    const videoRegex = /<video[^>]*([\s\S]*?)<\/video>/gi;
    let vm: RegExpExecArray | null;
    while ((vm = videoRegex.exec(scope)) !== null) {
      const block = vm[0];
      const srcM = block.match(/<source[^>]+src=["']([^"']+)["']/i) ||
        block.match(/<video[^>]+src=["']([^"']+)["']/i);
      const posterM = block.match(/poster=["']([^"']+)["']/i);
      if (srcM?.[1]) {
        const abs = absUrl(srcM[1], url);
        if (abs && !seen.has(abs)) {
          seen.add(abs);
          items.push({
            type: "video",
            url: abs,
            poster: posterM?.[1] ? absUrl(posterM[1], url) ?? undefined : undefined,
          });
        }
      }
    }

    // Cap la 12 items (peste asta = ads probabil)
    return items.slice(0, 12);
  } catch {
    return [];
  }
}

function absUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Heuristică junk detection: logo-uri (1x1 pixels), banner ads, social icons.
 * Pe URL strings (pattern names în filename) — nu fetchăm HEAD pentru fiecare.
 */
function isLikelyJunkImage(url: string): boolean {
  const lower = url.toLowerCase();
  // Tracking pixels + analytics
  if (/\.gif(\?|$)/.test(lower) && /\b(?:pixel|track|tag|beacon|analytics)\b/.test(lower)) {
    return true;
  }
  // Common ad / logo patterns
  return /(?:\/ads?\/|\/banner\/|\/logo[._-]|\/avatar[._-]|\/sprite[._-]|\.(?:svg|ico)$|placeholder|favicon|spacer|1x1|blank)/.test(lower);
}

export interface FetchAllResult {
  articles: RssArticle[];
  perFeed: Array<{ source: string; count: number; ok: boolean }>;
}

/**
 * Fetch all feeds, returning articles + per-source diagnostic.
 * Use the diagnostic to detect dead feeds in production logs.
 */
export async function fetchAllFeedsWithDiag(): Promise<FetchAllResult> {
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f)));
  const articles: RssArticle[] = [];
  const perFeed: FetchAllResult["perFeed"] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const f = FEEDS[i];
    if (!f) continue;
    if (r?.status === "fulfilled") {
      articles.push(...r.value);
      perFeed.push({ source: f.source, count: r.value.length, ok: true });
      if (r.value.length === 0) {
        console.warn(`[stiri] ${f.source} returned 0 articles`);
      }
    } else {
      perFeed.push({ source: f.source, count: 0, ok: false });
      console.error(`[stiri] ${f.source} REJECTED:`, (r?.reason as Error)?.message);
    }
  }

  // Scrape OG images for articles that don't have one (batch, max 30)
  const noImage = articles.filter((a) => !a.image_url);
  const batchImg = noImage.slice(0, 30);
  if (batchImg.length > 0) {
    const images = await Promise.all(batchImg.map((a) => fetchOgImage(a.url)));
    batchImg.forEach((a, i) => {
      if (images[i]) a.image_url = images[i];
    });
  }

  // Scrape full media (galerie poze + videouri din articol) — max 25 noi
  // articles per run ca să nu blocăm cron-ul. Restul backfill via script.
  const mediaBatch = articles.slice(0, 25);
  const mediaResults = await Promise.allSettled(
    mediaBatch.map((a) => fetchArticleMedia(a.url)),
  );
  mediaBatch.forEach((a, i) => {
    const r = mediaResults[i];
    if (r?.status === "fulfilled") a.media = r.value;
  });

  return { articles, perFeed };
}

/** Backwards-compat: old call site only wanted the articles. */
export async function fetchAllFeeds(): Promise<RssArticle[]> {
  const { articles } = await fetchAllFeedsWithDiag();
  return articles;
}
