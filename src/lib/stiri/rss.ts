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
 * articolului. Best-effort, fast timeout.
 *
 * Bug fix 5/24/2026: filtru aggressive pentru poze nerelevante:
 *  - Skip imagini din <aside>, <nav>, <footer>, <header>, sidebar containers
 *  - Skip cross-domain images (Google logos, social icons, related thumbnails)
 *  - Skip imagini cu class suspectă: logo/icon/avatar/related/share/follow
 *  - Skip filename-uri WordPress thumbnail (-150x150, -300x200) = previews
 *  - srcset reading → ia VARIANTA CU REZOLUȚIE MAXIMĂ (nu thumbnail)
 *
 * Cap 10 items (defensiv).
 */
export async function fetchArticleMedia(
  url: string,
  knownHero?: string | null,
): Promise<MediaItem[]> {
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

    // Use HTML întreg ca scope — strippăm doar nav/aside/footer/header.
    // Article-tag scope era prea narrow (G4Media etc. nu îl folosesc),
    // iar wrapper class regex era prea ambiguu și prindea div-uri greșite.
    // Filtrele per-img (junk + cross-domain + thumbnail size) elimină
    // restul.
    let scope = html;

    // Hero image: prefer knownHero (calculat de fetchOgImage cu fallback
    // multi-selector — vezi rss.ts → ai mai sus). Fallback la og:image
    // sau twitter:image din current fetch. NU folosim logo/junk.
    let heroImage: string | null = knownHero ?? null;
    if (heroImage && (isLikelyJunkImage(heroImage) || !looksLikeImageUrl(heroImage))) {
      heroImage = null;
    }
    if (!heroImage) {
      const candidates: RegExp[] = [
        /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
        /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
      ];
      for (const re of candidates) {
        const m = html.match(re);
        const found = m?.[1] ? absUrl(m[1], url) : null;
        if (found && looksLikeImageUrl(found) && !isLikelyJunkImage(found)) {
          heroImage = found;
          break;
        }
      }
    }

    // Strip out nested junk containers PE SCOPE (aside, nav, footer, header,
    // related-articles, share-buttons, sidebar) — restul scrape-uim curat.
    scope = stripJunkContainers(scope);

    // Articol origin pentru filtru cross-domain
    let articleOrigin: string;
    try {
      articleOrigin = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return [];
    }

    const items: MediaItem[] = [];
    const seen = new Set<string>();

    // 2. <figure> blocks (au caption nativ <figcaption>)
    const figureRegex = /<figure[^>]*>([\s\S]*?)<\/figure>/gi;
    let fm: RegExpExecArray | null;
    while ((fm = figureRegex.exec(scope)) !== null) {
      const block = fm[1] ?? "";
      const imgTagM = block.match(/<img[^>]*>/i);
      if (!imgTagM) continue;
      const imgTag = imgTagM[0];
      const url2 = pickBestImgUrl(imgTag, url);
      if (!url2 || !isRelevantImage(url2, imgTag, articleOrigin) || seen.has(url2)) continue;
      seen.add(url2);
      const captionM = block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
      const altM = imgTag.match(/alt=["']([^"']*)["']/i);
      const cap = captionM?.[1] ? stripTags(captionM[1]) : altM?.[1];
      items.push({
        type: "image",
        url: url2,
        caption: cap && cap.length > 3 ? cap : undefined,
      });
    }

    // 3. <img> standalone (cele care nu sunt în figure deja procesate)
    const imgRegex = /<img[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRegex.exec(scope)) !== null) {
      const imgTag = im[0];
      const url2 = pickBestImgUrl(imgTag, url);
      if (!url2 || !isRelevantImage(url2, imgTag, articleOrigin) || seen.has(url2)) continue;
      seen.add(url2);
      const altM = imgTag.match(/alt=["']([^"']*)["']/i);
      items.push({
        type: "image",
        url: url2,
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

    // Garantăm că hero declarat e mereu primul item.
    if (heroImage && looksLikeImageUrl(heroImage) && !isLikelyJunkImage(heroImage)) {
      const existingIdx = items.findIndex((m) => m.url === heroImage);
      if (existingIdx > 0) {
        const [hero] = items.splice(existingIdx, 1);
        if (hero) items.unshift(hero);
      } else if (existingIdx === -1) {
        items.unshift({ type: "image", url: heroImage });
      }
    }

    // Dedupe pe filename (chiar dacă URL-urile diferă din cauza CDN-urilor,
    // imaginea de bază poate fi identică). Pattern: extragem ultimul
    // path segment care arată ca un filename `.jpg/.png/etc`.
    const seenFilenames = new Set<string>();
    const deduped: MediaItem[] = [];
    for (const m of items) {
      const fnMatch = m.url.match(/([a-z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|gif))(?:\?|$)/i);
      const fn = fnMatch?.[1]?.toLowerCase();
      if (fn) {
        if (seenFilenames.has(fn)) continue;
        seenFilenames.add(fn);
      }
      deduped.push(m);
    }

    // Cap la 10 items (peste asta = related-articles probabil)
    return deduped.slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Strip out semantic non-article containers (<aside>, <nav>, <footer>,
 * <header>). Restul (clase, id-uri) lăsăm scrape-ul să decidă per-img,
 * fiindcă regex-ul de class-stripping era prea aggressive și tăia
 * containerul articolului real pe site-uri custom (G4Media etc.).
 */
function stripJunkContainers(html: string): string {
  let out = html;
  const blockTags = ["aside", "nav", "footer", "header"];
  for (const tag of blockTags) {
    const re = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi");
    out = out.replace(re, "");
  }
  return out;
}

/**
 * Pick the highest-resolution image URL from a single <img> tag.
 * Prefer srcset cu cea mai mare lățime (w descriptor) sau cel mai mare
 * density (x descriptor). Fallback la src.
 */
function pickBestImgUrl(imgTag: string, baseUrl: string): string | null {
  // Try srcset first (highest-res variant)
  const srcsetM = imgTag.match(/srcset=["']([^"']+)["']/i);
  if (srcsetM?.[1]) {
    // Parse „url 1x, url2 2x, url3 800w, url4 1200w" — pick best
    const candidates = srcsetM[1].split(",").map((s) => {
      const parts = s.trim().split(/\s+/);
      const url = parts[0];
      const desc = parts[1] ?? "1x";
      let weight = 0;
      if (desc.endsWith("w")) {
        weight = parseInt(desc, 10) || 0;
      } else if (desc.endsWith("x")) {
        // density: 2x ~ 2000w-equivalent for sorting
        weight = (parseFloat(desc) || 1) * 1000;
      }
      return { url, weight };
    });
    candidates.sort((a, b) => b.weight - a.weight);
    if (candidates[0]?.url) {
      const abs = absUrl(candidates[0].url, baseUrl);
      if (abs) return abs;
    }
  }
  // Fallback: data-src (lazy-load), then src
  const dataSrcM = imgTag.match(/data-src=["']([^"']+)["']/i);
  const srcM = imgTag.match(/\bsrc=["']([^"']+)["']/i);
  const candidate = dataSrcM?.[1] ?? srcM?.[1];
  if (!candidate) return null;
  return absUrl(candidate, baseUrl);
}

/**
 * True dacă image-ul pare LEGITIM pentru articol:
 *   - Looks like an image extension (jpg/png/webp/etc)
 *   - Not in junk list (logos/icons/tracking pixels)
 *   - Same domain (or empty hostname) — cross-domain skip (Google logos,
 *     social icons, related thumbnails de pe alt site)
 *   - Class/id NU conține „logo/icon/avatar/share/follow"
 *   - URL NU conține WordPress thumbnail pattern (-150x150)
 */
function isRelevantImage(
  url: string,
  imgTag: string,
  articleOrigin: string,
): boolean {
  if (!looksLikeImageUrl(url)) return false;
  if (isLikelyJunkImage(url)) return false;

  // Cross-domain filter: păstrăm doar same domain (or CDN subdomain pe
  // același registrable domain). Logo-uri Google/Facebook/Twitter etc
  // sunt third-party și nu interesează articolul.
  try {
    const imgHost = new URL(url).hostname.replace(/^www\./, "");
    if (imgHost && imgHost !== articleOrigin) {
      // Permite subdomain-uri pe același registrable (cdn.gandul.ro pe gandul.ro)
      const articleRoot = articleOrigin.split(".").slice(-2).join(".");
      const imgRoot = imgHost.split(".").slice(-2).join(".");
      if (imgRoot !== articleRoot) return false;
    }
  } catch {
    return false;
  }

  // Class / alt heuristic — skip dacă tag-ul are clase suspecte
  const tagLower = imgTag.toLowerCase();
  if (
    /class=["'][^"']*(?:logo|icon|avatar|share|social|follow|subscribe|sponsor|advert|sidebar|widget|emoji)[^"']*["']/i.test(
      tagLower,
    )
  ) {
    return false;
  }

  // WordPress thumbnail patterns: -150x150, -300x200, -75x75 (sidebar previews)
  if (/-\d{2,4}x\d{2,4}\.(?:jpg|jpeg|png|webp|avif|gif)/i.test(url)) {
    const m = url.match(/-(\d{2,4})x(\d{2,4})\.(?:jpg|jpeg|png|webp|avif|gif)/i);
    if (m && parseInt(m[1] ?? "0", 10) < 400) return false;
  }

  // CDN image proxy patterns: /150x84/, /200x200/, /300x180/, etc.
  // (Thumbor, Imgix, Cloudinary path-style — folosit pentru thumbnails
  // de „related articles" sidebar). Cap minim 400px ca să eliminăm
  // chestii ascunse într-un grid de „mai citește".
  const cdnSizeMatch = url.match(/\/(\d{2,4})x(\d{2,4})\//);
  if (cdnSizeMatch) {
    const w = parseInt(cdnSizeMatch[1] ?? "0", 10);
    if (w < 400) return false;
  }

  // Alt text suggests it's UI chrome, not content
  const altM = imgTag.match(/alt=["']([^"']*)["']/i);
  const altText = altM?.[1]?.toLowerCase() ?? "";
  if (
    /^(?:logo|icon|avatar|share|follow|subscribe|google|facebook|twitter|linkedin|email|whatsapp)$/i.test(
      altText,
    )
  ) {
    return false;
  }
  // Substring match — alt text conține „urmărește-ne", „abonează-te",
  // „google news/discover/play", „follow us on...", etc.
  if (
    /\b(?:urmărește|urmareste|abonează|aboneaza|follow|share|distribuie|powered by|google\s*(?:news|discover|play|plus)|subscribe|newsletter|sign[\s-]?up)\b/i.test(
      altText,
    )
  ) {
    return false;
  }

  return true;
}

function absUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, "")
    .replace(/&#8221;/g, "")
    .replace(/&#8230;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristică junk detection: logo-uri (1x1 pixels), banner ads, social icons.
 */
function isLikelyJunkImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.gif(\?|$)/.test(lower) && /\b(?:pixel|track|tag|beacon|analytics)\b/.test(lower)) {
    return true;
  }
  return /(?:\/ads?\/|\/banner\/|\/logo[._\-\/]|\/avatars?\/|\/sprite[._\-\/]|\.(?:svg|ico)$|placeholder|favicon|spacer|1x1|blank|gravatar|google[-_]|googlenews|emoji|\/(?:facebook|twitter|instagram|tiktok|youtube|linkedin|whatsapp|telegram|pinterest|reddit|threads|mastodon|bluesky|signal|messenger|viber|skype|wechat|line|kakao)[-_.]|share[-_]?(?:button|icon)?\.|follow[-_]?us|subscribe[-_]?(?:button|icon)|powered[-_]?by)/.test(
    lower,
  );
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
