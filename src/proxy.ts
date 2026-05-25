import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCspWithNonce } from "@/lib/csp/nonce";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

// Opt-in via env flag — when CSP_NONCE_MODE=on, we generate a per-request
// nonce and forward it via x-csp-nonce header so Server Components can
// read it via headers(). When OFF (default), the static CSP from
// next.config.ts is used. Allows a safe gradual rollout.
const NONCE_MODE_ON = process.env.CSP_NONCE_MODE === "on";

function withNonce(res: NextResponse, request: NextRequest): NextResponse {
  if (!NONCE_MODE_ON) return res;
  const nonce = generateNonce();
  // Forward to RSC via request headers (echoed back as response header).
  request.headers.set("x-csp-nonce", nonce);
  res.headers.set("x-csp-nonce", nonce);
  res.headers.set("Content-Security-Policy", buildCspWithNonce(nonce));
  return res;
}

// 2026-05-24: județul personalizat ELIMINAT. Site-ul e DOAR național.
// COUNTY_SLUGS rămas pentru redirect-uri legacy (/{slug}/<national-only-path>
// → /<national-only-path>) și pentru paginile /[judet]/* care există
// în continuare (vor fi curățate în Faza 2).
const COUNTY_SLUGS = new Set([
  "ab","ar","ag","bc","bh","bn","bt","br","bv","b","bz","cl","cs","cj","ct",
  "cv","db","dj","gl","gr","gj","hr","hd","il","is","if","mm","mh","ms","nt",
  "ot","ph","sj","sm","sb","sv","tr","tm","tl","vl","vs","vn",
]);

// Rute sterse care apar inca in analytics (Reddit, Google cache, share-uri
// vechi). Redirect 308 catre destinatii utile in loc de 404.
// Update 2026-05-13 dupa audit analytics: /aer, /b/aer, /harti, /b/harti,
// /cj/harti, /buget, /compara, /calendar-civic, /impact.
// 2026-05-24 — minimalism. Pagini scoase la cererea user-ului: /dezvoltatori,
// /despre, /status, /civic-pulse, /roadmap, /okrs, /security, /whistleblower,
// /legal/cod-de-conduita, /legal/dpa-autoritati. Redirect 308 la home pentru
// link-uri vechi / Google cache.
const LEGACY_REDIRECTS: Record<string, string> = {
  "/harti": "/",
  "/aer": "/",
  "/buget": "/",
  "/compara": "/",
  "/dezvoltatori": "/",
  "/despre": "/",
  "/status": "/",
  "/civic-pulse": "/",
  "/roadmap": "/",
  "/okrs": "/",
  "/security": "/",
  "/whistleblower": "/",
  "/legal/cod-de-conduita": "/",
  "/legal/dpa-autoritati": "/",
  "/calendar-civic": "/proteste",
  "/impact": "/",
  // 2026-05-19: sterse ghost pages — redirect la /ghiduri (cel mai relevant).
  "/educatie": "/ghiduri",
  "/sanatate": "/ghiduri",
  "/siguranta": "/ghiduri",
  // 5/23/2026: /judete + /judete/[id] sterse — redirect la home.
  "/judete": "/",
  // 5/23/2026: /autoritati pagina națională ștearsă (versiunea per-județ
  // /{slug}/autoritati rămâne accesibilă). Redirect la home pentru link-uri
  // vechi / Google cache.
  "/autoritati": "/",
  // 5/24/2026 — Faza 1 minimalism: alegeri, stickers, civic-awards șterse
  // (pagini ghost, traffic <5/zi). Redirect 308 la home.
  "/alegeri": "/",
  "/stickers": "/",
  "/civic-awards": "/clasament",
  // 5/24/2026 — Declarație accesibilitate ștearsă la cererea user-ului.
  "/legal/accesibilitate": "/",
  // 5/25/2026 — Clasament primării (separate) → consolidat în /clasament.
  "/clasament-primarii": "/clasament",
};

// NOTĂ: /intreruperi NU e în REDIRECT_EXACT — e pagină națională agregată
// ca /autoritati. Versiunea per-județ a fost mutată (2026-05-19) de la
// /{slug}/intreruperi la /intreruperi/{slug} (ex: /intreruperi/b,
// /intreruperi/cj). Vechea URL /{slug}/intreruperi rămâne ca redirect 308
// permanent gestionat de page.tsx-ul din /app/[judet]/intreruperi/.

// Paths care există DOAR ca național (NU au /[judet]/<path> echivalent).
// Conform AGENTS.md: /sesizari, /petitii, /ghiduri sunt action surfaces
// național-only. /sesizari-publice e feed comunitar național.
//
// Google + share-uri externe au indexat URL-uri tip „/b/petitii" — astea
// dădeau 404. Acum 308-redirectăm la versiunea națională.
// Raport analytics (5/8/2026): 3 hit-uri 404 pe /b/petitii, plus /b/ghiduri
// și similar pe alte județe.
const NATIONAL_ONLY_PATHS = ["petitii", "ghiduri", "sesizari-publice"] as const;

/**
 * Per-request supabase session refresh. CRITICAL pentru auth persistence:
 * fără un getUser() call în middleware, access-token-ul JWT (default
 * TTL 1h) expiră silent → utilizatorul „logged out" la re-vizită chiar
 * dacă refresh-token-ul e valid. Bug raportat user 5/21/2026.
 *
 * Returnează (response, refreshed) — caller folosește `response` ca
 * obiect base, sau ignoră refresh-ul când redirect-uim (cookie nu mai
 * trebuie atașat la redirect).
 */
async function refreshAuth(request: NextRequest, baseRes: NextResponse): Promise<NextResponse> {
  return updateSupabaseSession(request, baseRes);
}

// 2026-05-25 OPTIMIZATION: paths care NU au nevoie de auth refresh.
// Sitemap, robots, RSS feeds, ICS, opengraph-image — toate sunt
// cacheable la edge, zero per-user state. Early return → -100K
// edge requests Supabase auth call/lună.
const PUBLIC_NO_AUTH_PATHS = new Set([
  "/sitemap.xml",
  "/robots.txt",
  "/feed.xml",
  "/stiri-feed.xml",
  "/manifest.webmanifest",
  "/sw.js",
]);

function isPublicNoAuthPath(pathname: string): boolean {
  if (PUBLIC_NO_AUTH_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/intreruperi/rss")) return true;
  if (pathname.startsWith("/api/v2/sesizari/export.csv")) return true;
  if (pathname.startsWith("/proteste/feed")) return true;
  if (pathname.startsWith("/intreruperi/rss")) return true;
  if (pathname.endsWith("/opengraph-image")) return true;
  return false;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 2026-05-25 EARLY RETURN: pe paths publice fără auth refresh nu mai
  // facem updateSupabaseSession (skip Supabase getUser round-trip).
  if (isPublicNoAuthPath(pathname)) {
    return withNonce(NextResponse.next(), request);
  }

  // ─── Legacy routes 308 redirects (rute sterse, vezi LEGACY_REDIRECTS) ──
  const legacyTarget = LEGACY_REDIRECTS[pathname];
  if (legacyTarget) {
    const url = request.nextUrl.clone();
    url.pathname = legacyTarget;
    return NextResponse.redirect(url, 308);
  }

  // Match /{county}/{harti|aer} → /{county} (paginile au fost sterse;
  // județul are propria homepage care arata aceleaśi informații).
  const legacyCountyMatch = pathname.match(/^\/([a-z]{1,3})\/(harti|aer)(\/.*)?$/);
  if (legacyCountyMatch) {
    const slug = legacyCountyMatch[1] ?? "";
    if (COUNTY_SLUGS.has(slug)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${slug}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // 2026-05-24: „come home to your county" REMOVED.
  // Homepage e DOAR național. Userii ajung mereu la /, fără cookie redirect.
  // Cookie-ul `county` rămâne pentru afișări UI contextuale (badge „Bucuresti")
  // dar nu mai influențează routing-ul.

  // ─── National-only paths accidentally county-prefixed ──────────────
  // /b/petitii, /cj/ghiduri etc → 308 redirect la /petitii / /ghiduri.
  // Match: /{2-letter-slug}/{petitii|ghiduri|sesizari-publice}[/...]
  const m = pathname.match(/^\/([a-z]{1,3})\/([^/]+)(\/.*)?$/);
  if (m) {
    const slug = m[1] ?? "";
    const segment = m[2] ?? "";
    const rest = m[3];
    if (
      COUNTY_SLUGS.has(slug) &&
      (NATIONAL_ONLY_PATHS as readonly string[]).includes(segment)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${segment}${rest ?? ""}`;
      // 308 (permanent) — relația /b/petitii → /petitii e fixă, nu depinde
      // de cookie sau user. Browserele și Google pot cache-ui agresiv.
      return NextResponse.redirect(url, 308);
    }
  }

  // 2026-05-24: REDIRECT_EXACT (bilete/istoric) — eliminate, sunt
  // county-only pagini ce nu mai trebuie auto-prefixate. Userii vor
  // accesa direct /{slug}/bilete dacă vor.
  return refreshAuth(request, withNonce(NextResponse.next(), request));
}

// Matcher expandat 5/21/2026 ca proxy.ts sa ruleze pe TOATE paginile,
// nu doar pe rutele specifice. Critic pentru auth persistence:
// updateSupabaseSession() trebuie să aibă oportunitatea să refresh-eze
// cookie-urile de sesiune ÎN MIDDLEWARE, înainte ca RSC să le citească.
// Fără asta, access-token-ul JWT (TTL 1h) expira silent și userul ajungea
// „logged out" la reîntoarcere chiar dacă refresh-token-ul era valid.
//
// Excludem: assets static, API routes (own auth via cookies oricum),
// _next internal, favicon/manifest/sw, .well-known.
export const config = {
  matcher: [
    // Run on everything EXCEPT static files & internal Next paths.
    // Pattern echivalent cu „toate paginile + bypass static".
    "/((?!_next/static|_next/image|_next/data|favicon\\.ico|icon-|apple-icon|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|sw\\.js|opengraph-image|geojson/|images/|sounds/|fonts/|\\.well-known/).*)",
  ],
};
