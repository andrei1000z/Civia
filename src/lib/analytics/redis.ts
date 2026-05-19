import { Redis } from "@upstash/redis";

export const analyticsRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

export const KEY = {
  total: "civia:analytics:total",
  routes: "civia:analytics:routes",
  referrers: "civia:analytics:referrers",
  countries: "civia:analytics:countries",
  cities: "civia:analytics:cities",
  languages: "civia:analytics:languages",
  hourly: "civia:analytics:hourly",
  daily: (d: string) => `civia:analytics:daily:${d}`,
  dau: (d: string) => `civia:analytics:dau:${d}`,
  wau: (w: string) => `civia:analytics:wau:${w}`,
  mau: (m: string) => `civia:analytics:mau:${m}`,
  landingPages: "civia:analytics:landing-pages",
  landingMarker: (vid: string) => `civia:analytics:landing:${vid}`,
  utmSource: "civia:analytics:utm-source",
  utmMedium: "civia:analytics:utm-medium",
  utmCampaign: "civia:analytics:utm-campaign",
  events: "civia:analytics:events",
  eventsTotal: "civia:analytics:events-total",
  perf: "civia:analytics:perf",
  errors: "civia:analytics:errors",
  errorPaths: "civia:analytics:error-paths",
  errorSources: "civia:analytics:error-sources",
  scrollDepth: "civia:analytics:scroll-depth",
  topUsers: "civia:analytics:top-users",
  userMeta: (u: string) => `civia:analytics:user:${u}:meta`,
  userRoutes: (u: string) => `civia:analytics:user:${u}:routes`,
  userCountries: (u: string) => `civia:analytics:user:${u}:countries`,
  userDays: (u: string) => `civia:analytics:user:${u}:days`,
  excluded: "civia:analytics:excluded-users",

  // --- New tracking surfaces ---
  // Web Vitals: LCP, INP, CLS, FCP, TTFB. We keep per-metric rating
  // counts (good/needs-improvement/poor) and a reservoir-sampled list of
  // recent values for percentile estimation.
  vitalRating: (vital: string) => `civia:analytics:vital:${vital}:rating`,
  vitalSamples: (vital: string) => `civia:analytics:vital:${vital}:samples`,
  vitalPerRoute: (vital: string) => `civia:analytics:vital:${vital}:routes`,

  // Click tracking
  clicks: "civia:analytics:clicks",
  clicksPerRoute: "civia:analytics:clicks-per-route",

  // Outbound link destinations
  outbound: "civia:analytics:outbound",

  // Rage clicks — frustration signal. Keyed by route + label.
  rageClicks: "civia:analytics:rage-clicks",
  rageClicksPerRoute: "civia:analytics:rage-clicks-per-route",

  // Copy events
  copyEvents: "civia:analytics:copy",
  copyPerRoute: "civia:analytics:copy-per-route",

  // Network transitions
  offlineCount: "civia:analytics:offline-count",

  // Funnel — per-funnel-per-step counts, so the dashboard can compute
  // drop-off rates. One hash per funnel, fields are the step labels.
  funnel: (funnel: string) => `civia:analytics:funnel:${funnel}`,

  // Search — global + per-context (command palette, sesizari filter, etc.)
  searchTerms: "civia:analytics:search",
  searchZeroResults: "civia:analytics:search-zero",

  // AI feature usage (improve, chat, classify, vision, polish)
  aiUsage: "civia:analytics:ai-usage",

  // Auth events (signup, signin, signout, password-reset)
  authEvents: "civia:analytics:auth",

  // Form abandonment — per form, per step
  formAbandon: "civia:analytics:form-abandon",
  // Form abandonment per field — granular: `form|field` (ex: „sesizare|descriere").
  // Adaugat 2026-05-19 ca sa vedem EXACT pe ce field abandoneaza userii
  // (nu doar coarse step). Step ramane pentru funnel; field e diagnostic.
  formAbandonFields: "civia:analytics:form-abandon-fields",

  // Page time spent — histogram-ish, keyed by path
  timePerPath: "civia:analytics:time-per-path",

  // Viewport + orientation + color scheme tallies (per-session context)
  viewports: "civia:analytics:viewports",
  orientations: "civia:analytics:orientations",
  colorSchemes: "civia:analytics:color-schemes",
  connections: "civia:analytics:connections",

  // PWA install funnel
  pwaEvents: "civia:analytics:pwa-events",

  // AI vision routing telemetry — pentru endpoint /api/ai/vision-route
  // care primeste poza si returneaza tip + autoritate + confidence.
  //   visionConfidence: bucket-uri confidence (0-25/26-50/51-75/76-100/fallback)
  //   visionTips: distributia tip-urilor returnate de model
  //   visionAuthorities: distributia autoritatilor returnate
  //   visionAcceptance: accepted vs overridden de user (client-side track)
  visionConfidence: "civia:analytics:vision-confidence",
  visionTips: "civia:analytics:vision-tips",
  visionAuthorities: "civia:analytics:vision-authorities",
  visionAcceptance: "civia:analytics:vision-acceptance",

  // Referrer funnel — pe sursa de trafic (reddit/google/twitter/direct...),
  // numarul de sesiuni (unique vids) si non-bounces (sesiuni cu 2+ pageviews).
  // Bounce rate = 1 - (nonBounces / sessions). Folosit ca sa vedem cum
  // converteste fiecare canal (ex: Reddit are 9% trafic dar daca bounce
  // rate e 85%, postul nu engagement-uieste).
  sessionsPerReferrer: "civia:analytics:sessions-per-referrer",
  nonBouncesPerReferrer: "civia:analytics:non-bounces-per-referrer",

  // 404 paths — path-level breakdown pentru broken links / URL-uri
  // învechite / typo-uri / bots. Plus referrer-urile de unde vin
  // (ajută să identificăm broken links pe site-uri externe).
  notFoundPaths: "civia:analytics:404-paths",
  notFoundReferrers: "civia:analytics:404-referrers",

  // ─── Per-visitor session timeline ───────────────────────────────
  // Sorted set of recent visitors (score = last activity ms) — used pe
  // /admin/analytics/sessions ca să listăm utilizatorii cu activitate
  // recentă. Capped la 1000 prin pruning în handleTrack.
  vidsRecent: "civia:analytics:vids-recent",
  // Per-visitor metadata snapshot (device fingerprint la prima/ultima vizită).
  // Hash cu first_seen, last_seen, country, city, device, browser, os, lang,
  // viewport, screen, color_scheme, connection, utm_source, etc.
  vidMeta: (vid: string) => `civia:analytics:vid:${vid}:meta`,
  // Per-visitor event timeline — last 200 events per visitor cu TTL 30 zile.
  // Lista cu JSON-encoded events: { t, type, pathname?, label?, ...extra }.
  vidTimeline: (vid: string) => `civia:analytics:vid:${vid}:timeline`,
} as const;

export const TTL = {
  daily: 60 * 60 * 24 * 90,
  hourly: 60 * 60 * 24 * 7,
  dau: 60 * 60 * 24 * 90,
  wau: 60 * 60 * 24 * 60,
  mau: 60 * 60 * 24 * 90,
  events: 60 * 60 * 24 * 7,
  errors: 60 * 60 * 24 * 30,
  landingMarker: 60 * 60 * 24,
  user: 60 * 60 * 24 * 365,
  vitalSamples: 60 * 60 * 24 * 14,
  clicks: 60 * 60 * 24 * 30,
  search: 60 * 60 * 24 * 60,
  // Per-visitor: 30 zile keep timeline + meta. După 30 zile, vizitatorul
  // dispare automat din /admin/analytics/sessions (păstrăm doar aggregat).
  vidTimeline: 60 * 60 * 24 * 30,
  vidMeta: 60 * 60 * 24 * 30,
} as const;

// Per-visitor event timeline — keep last N events per visitor.
export const VID_TIMELINE_CAP = 200;
// Recent visitors cap — only show top-1000 by last activity in /admin.
export const VIDS_RECENT_CAP = 1000;

// Web Vitals reservoir sampling — keep at most 500 recent samples per
// metric so we can compute p50/p75/p95 without unbounded list growth.
export const VITAL_SAMPLE_CAP = 500;
