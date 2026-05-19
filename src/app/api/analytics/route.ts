import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { analyticsRedis, KEY, TTL, VITAL_SAMPLE_CAP, VID_TIMELINE_CAP, VIDS_RECENT_CAP } from "@/lib/analytics/redis";
import { sanitizeStr, sanitizeKey, sanitizeId } from "@/lib/analytics/sanitize";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { referrerSource } from "@/lib/analytics/referrer-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Production allowlist baked into the bundle. Localhost variants are
// added only outside production so a leaked local origin can't be
// spoofed to bypass the check on Vercel. Custom origins can be appended
// via NEXT_PUBLIC_ANALYTICS_ORIGINS (comma-separated) — used for staging
// previews etc.
const PROD_ORIGINS = ["https://civia.ro", "https://www.civia.ro"];
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];
const EXTRA_ORIGINS = (process.env.NEXT_PUBLIC_ANALYTICS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set<string>([
  ...PROD_ORIGINS,
  ...(process.env.NODE_ENV === "production" ? [] : DEV_ORIGINS),
  ...EXTRA_ORIGINS,
]);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function hourKey(): string {
  return new Date().toISOString().slice(0, 13).replace("T", " ");
}
function monthKey(): string {
  return today().slice(0, 7);
}
function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function getSessionUser(): Promise<{ id: string; role?: string } | null> {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return { id: user.id, role: (profile as { role?: string } | null)?.role };
  } catch {
    return null;
  }
}

async function isAdmin(): Promise<boolean> {
  const u = await getSessionUser();
  return u?.role === "admin";
}

/**
 * handleTrackBatch — primește un array de evenimente (acum până la
 * 30 per batch) și le procesează unul câte unul prin handleTrack.
 * Trimis de client după 2s buffer (vezi CiviaTracker.flushBatch).
 *
 * Beneficiu vs un eveniment per request:
 * - 1 request HTTP în loc de 30 → mai puțin cost rețea + Vercel
 * - Rate limit aplicat pe batch (1 hit), nu per eveniment (30 hits)
 * - Origin check + auth check rulează o singură dată
 */
async function handleTrackBatch(req: NextRequest, body: Record<string, unknown>) {
  if (!analyticsRedis) return NextResponse.json({ ok: true, noop: true });

  const ip = getClientIp(req);
  // Rate limit pe batch — un user activ poate trimite max 60 batches/min.
  // Cu 30 evenimente per batch înseamnă max 1800 events/min/IP, suficient
  // pentru SPA navigation agresivă; blochează scrape abuse.
  const rl = await rateLimitAsync(`analytics-batch:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ ok: false, rateLimited: true }, { status: 429 });

  const events = body.events;
  if (!Array.isArray(events)) {
    return NextResponse.json({ error: "events must be array" }, { status: 400 });
  }
  // Cap defensiv pe server: 50 evenimente max (clientul trimite max 30)
  const limited = events.slice(0, 50);

  let ok = 0;
  let failed = 0;
  for (const ev of limited) {
    if (typeof ev !== "object" || ev === null) {
      failed++;
      continue;
    }
    try {
      // Reuse handleTrack — pasăm flag _batched ca să sară peste rate-limit
      // (deja verificat o dată la nivel batch).
      await handleTrack(req, ev as Record<string, unknown>, true);
      ok++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ ok: true, processed: ok, failed });
}

async function handleTrack(req: NextRequest, body: Record<string, unknown>, _batched = false) {
  if (!analyticsRedis) return NextResponse.json({ ok: true, noop: true });

  // Rate limit per IP — sărit pentru evenimente batch (deja verificat).
  if (!_batched) {
    const ip = getClientIp(req);
    const rl = await rateLimitAsync(`analytics:${ip}`, { limit: 60, windowMs: 60_000 });
    if (!rl.success) return NextResponse.json({ ok: false, rateLimited: true }, { status: 429 });
  }

  const visitorId = sanitizeId(body.visitorId);
  if (!visitorId) return NextResponse.json({ ok: true });

  // Resolve user id server-side from Supabase session — never trust client.
  const sessionUser = await getSessionUser();
  const userId = sessionUser?.id || "";

  // Admins are automatically excluded from tracking.
  if (sessionUser?.role === "admin") {
    return NextResponse.json({ ok: true, excluded: true });
  }
  if (userId) {
    const excluded = await analyticsRedis.sismember(KEY.excluded, userId);
    if (excluded) return NextResponse.json({ ok: true, excluded: true });
  }

  const eventType = sanitizeKey(body.eventType, 30) || "pageview";
  const country = (req.headers.get("x-vercel-ip-country") || "XX").slice(0, 4);
  let city = "unknown";
  try {
    const raw = req.headers.get("x-vercel-ip-city");
    if (raw) city = sanitizeKey(decodeURIComponent(raw), 50) || "unknown";
  } catch { /* noop */ }

  const now = Date.now();
  const d = today();
  const h = hourKey();
  const m = monthKey();
  const w = weekKey();

  const pipe = analyticsRedis.pipeline();

  if (eventType === "pageview") {
    const pathname = sanitizeKey(body.pathname, 120) || "/";
    const displayMode = sanitizeKey(body.displayMode, 20) || "browser";
    const deviceType = sanitizeKey(body.deviceType, 20) || "unknown";
    const browser = sanitizeKey(body.browser, 30) || "unknown";
    const os = sanitizeKey(body.os, 20) || "unknown";
    const referrer = sanitizeKey(body.referrer, 100) || "direct";
    const language = sanitizeKey(body.language, 10) || "unknown";
    const viewport = sanitizeKey(body.viewport, 10) || "unknown";
    const colorScheme = sanitizeKey(body.colorScheme, 10) || "unknown";
    const connection = sanitizeKey(body.connection, 10) || "unknown";
    const loadTime = typeof body.loadTime === "number" ? body.loadTime : 0;

    pipe.hincrby(KEY.total, "views", 1);
    pipe.hincrby(KEY.total, `display_${displayMode}`, 1);
    pipe.hincrby(KEY.total, `device_${deviceType}`, 1);
    pipe.hincrby(KEY.total, `browser_${browser}`, 1);
    pipe.hincrby(KEY.total, `os_${os}`, 1);
    pipe.hincrby(KEY.total, `viewport_${viewport}`, 1);
    pipe.hincrby(KEY.total, `color_${colorScheme}`, 1);
    pipe.hincrby(KEY.total, `conn_${connection}`, 1);

    // Scriu și în hash-urile separate (viewports, colorSchemes, connections,
    // orientations) ca să fie consumabile direct de dashboard + pull scripts.
    // Bug istoric: datele erau doar în KEY.total ca prefix, dashboardul
    // citea hash-urile separate și găsea gol.
    pipe.hincrby(KEY.viewports, viewport, 1);
    pipe.hincrby(KEY.colorSchemes, colorScheme, 1);
    pipe.hincrby(KEY.connections, connection, 1);
    const orientation = sanitizeKey(body.orientation, 10) || "unknown";
    pipe.hincrby(KEY.orientations, orientation, 1);

    pipe.hincrby(KEY.routes, pathname, 1);
    pipe.hincrby(KEY.referrers, referrer, 1);
    pipe.hincrby(KEY.countries, country, 1);
    pipe.hincrby(KEY.cities, `${city}, ${country}`, 1);
    pipe.hincrby(KEY.languages, language, 1);

    pipe.hincrby(KEY.hourly, h, 1);
    pipe.expire(KEY.hourly, TTL.hourly);

    pipe.hincrby(KEY.daily(d), "views", 1);
    pipe.expire(KEY.daily(d), TTL.daily);

    const utmSource = sanitizeKey(body.utmSource, 50);
    const utmMedium = sanitizeKey(body.utmMedium, 50);
    const utmCampaign = sanitizeKey(body.utmCampaign, 100);
    if (utmSource) pipe.hincrby(KEY.utmSource, utmSource, 1);
    if (utmMedium) pipe.hincrby(KEY.utmMedium, utmMedium, 1);
    if (utmCampaign) pipe.hincrby(KEY.utmCampaign, utmCampaign, 1);

    pipe.sadd(KEY.dau(d), visitorId);
    pipe.expire(KEY.dau(d), TTL.dau);
    pipe.sadd(KEY.wau(w), visitorId);
    pipe.expire(KEY.wau(w), TTL.wau);
    pipe.sadd(KEY.mau(m), visitorId);
    pipe.expire(KEY.mau(m), TTL.mau);

    if (loadTime > 0 && loadTime < 60000) {
      pipe.hincrby(KEY.perf, "load_total", loadTime);
      pipe.hincrby(KEY.perf, "load_count", 1);
    }

    // Real-time feed (last 200)
    pipe.lpush(
      KEY.events,
      JSON.stringify({
        t: now,
        type: "pageview",
        pathname,
        country,
        city,
        device: deviceType,
        browser,
        referrer,
      })
    );
    pipe.ltrim(KEY.events, 0, 199);
    pipe.expire(KEY.events, TTL.events);

    // Per-user tracking
    if (userId) {
      pipe.zincrby(KEY.topUsers, 1, userId);
      pipe.hsetnx(KEY.userMeta(userId), "first_seen", String(now));
      pipe.hset(KEY.userMeta(userId), {
        last_seen: String(now),
        last_country: country,
        last_pathname: pathname,
        last_device: deviceType,
        last_browser: browser,
      });
      pipe.hincrby(KEY.userMeta(userId), "views", 1);
      pipe.expire(KEY.userMeta(userId), TTL.user);
      pipe.hincrby(KEY.userRoutes(userId), pathname, 1);
      pipe.expire(KEY.userRoutes(userId), TTL.user);
      pipe.hincrby(KEY.userCountries(userId), country, 1);
      pipe.expire(KEY.userCountries(userId), TTL.user);
      pipe.hincrby(KEY.userDays(userId), d, 1);
      pipe.expire(KEY.userDays(userId), TTL.user);
    }

    // ─── Per-visitor session tracking (anonymous, by vid) ──────────
    // Snapshot device fingerprint pe vidMeta + adaugă pageview în
    // timeline. Sorted set vidsRecent ține track de cei mai recenți.
    pipe.hsetnx(KEY.vidMeta(visitorId), "first_seen", String(now));
    pipe.hset(KEY.vidMeta(visitorId), {
      last_seen: String(now),
      country,
      city: `${city}, ${country}`,
      device: deviceType,
      browser,
      os,
      language,
      viewport,
      screen: sanitizeKey(body.screenSize, 30) || "unknown",
      color_scheme: colorScheme,
      connection,
      orientation,
      display_mode: displayMode,
      timezone: sanitizeKey(body.timezone, 50) || "unknown",
      last_pathname: pathname,
      last_referrer: referrer,
    });
    // Bounce/session telemetry pe sursa de referrer. Incrementam pageviews
    // pe vidMeta cu un round-trip separat ca sa cunoastem noua valoare:
    //   1 → prima vizualizare (sesiune noua) → +1 sessionsPerReferrer
    //   2 → a doua vizualizare (sesiune nu mai e bounce) → +1 nonBouncesPerReferrer
    //   >2 → deja non-bounce, nu mai numaram
    // Sursa bucket-uita prin referrerSource (reddit/google/direct/...).
    try {
      const newPageviews = await analyticsRedis.hincrby(KEY.vidMeta(visitorId), "pageviews", 1);
      const source = referrerSource(referrer);
      if (newPageviews === 1) {
        await analyticsRedis.hincrby(KEY.sessionsPerReferrer, source, 1);
      } else if (newPageviews === 2) {
        await analyticsRedis.hincrby(KEY.nonBouncesPerReferrer, source, 1);
      }
    } catch { /* never block pageview on telemetry */ }
    pipe.hsetnx(KEY.vidMeta(visitorId), "first_referrer", referrer);
    pipe.hsetnx(KEY.vidMeta(visitorId), "first_pathname", pathname);
    if (utmSource) {
      pipe.hsetnx(KEY.vidMeta(visitorId), "first_utm_source", utmSource);
      pipe.hset(KEY.vidMeta(visitorId), { last_utm_source: utmSource });
    }
    if (utmCampaign) {
      pipe.hsetnx(KEY.vidMeta(visitorId), "first_utm_campaign", utmCampaign);
    }
    pipe.expire(KEY.vidMeta(visitorId), TTL.vidMeta);

    // Add la timeline (most-recent-first, capped la VID_TIMELINE_CAP).
    pipe.lpush(
      KEY.vidTimeline(visitorId),
      JSON.stringify({ t: now, type: "pageview", pathname, referrer }),
    );
    pipe.ltrim(KEY.vidTimeline(visitorId), 0, VID_TIMELINE_CAP - 1);
    pipe.expire(KEY.vidTimeline(visitorId), TTL.vidTimeline);

    // Add la sorted set "vids recent". Score = timestamp ms al ultimei activități.
    pipe.zadd(KEY.vidsRecent, { score: now, member: visitorId });

    await pipe.exec();

    // Prune sorted set la max VIDS_RECENT_CAP — păstrăm doar topul recent.
    try {
      const total = await analyticsRedis.zcard(KEY.vidsRecent);
      if (total > VIDS_RECENT_CAP) {
        await analyticsRedis.zremrangebyrank(KEY.vidsRecent, 0, total - VIDS_RECENT_CAP - 1);
      }
    } catch { /* noop */ }

    // Landing-page marker — separate SET NX call (not pipelineable with decision)
    try {
      const res = await analyticsRedis.set(KEY.landingMarker(visitorId), pathname, {
        ex: TTL.landingMarker,
        nx: true,
      });
      if (res) await analyticsRedis.hincrby(KEY.landingPages, pathname, 1);
    } catch { /* noop */ }

    return NextResponse.json({ ok: true });
  }

  if (eventType === "time-on-page") {
    const t = typeof body.timeOnPage === "number" ? body.timeOnPage : 0;
    if (t > 0 && t < 3600000) {
      pipe.hincrby(KEY.perf, "time_total", t);
      pipe.hincrby(KEY.perf, "time_count", 1);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }

  // 404 tracking — path + referrer separat, ca să vedem broken links
  if (eventType === "404") {
    const path = sanitizeKey(body.pathname, 120) || "/";
    const ref = sanitizeKey(body.referrer, 100) || "direct";
    pipe.hincrby(KEY.notFoundPaths, path, 1);
    pipe.hincrby(KEY.notFoundReferrers, ref, 1);
    pipe.hincrby(KEY.eventsTotal, "404", 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  if (eventType === "js-error") {
    const err = sanitizeKey(body.error, 200);
    const path = sanitizeKey(body.pathname, 120);
    const src = sanitizeKey(body.errorSrc, 120);
    if (err) {
      pipe.hincrby(KEY.errors, err, 1);
      pipe.expire(KEY.errors, TTL.errors);
      if (path) pipe.hincrby(KEY.errorPaths, path, 1);
      if (src) pipe.hincrby(KEY.errorSources, src, 1);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }

  if (eventType === "scroll-depth") {
    const depth = sanitizeKey(body.depth, 10);
    if (depth) {
      pipe.hincrby(KEY.scrollDepth, depth, 1);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }

  // Web Vitals — LCP, INP, CLS, FCP, TTFB
  if (eventType === "web-vital") {
    const vital = sanitizeKey(body.vital, 10);
    const rating = sanitizeKey(body.rating, 20);
    const path = sanitizeKey(body.pathname, 120) || "/";
    const rawValue = typeof body.value === "number" ? body.value : parseFloat(String(body.value ?? 0));
    if (vital && rating && Number.isFinite(rawValue) && rawValue >= 0) {
      pipe.hincrby(KEY.vitalRating(vital), rating, 1);
      // Reservoir sampling via LPUSH + LTRIM — keeps the most recent
      // VITAL_SAMPLE_CAP values per metric for percentile estimation.
      pipe.lpush(KEY.vitalSamples(vital), String(rawValue));
      pipe.ltrim(KEY.vitalSamples(vital), 0, VITAL_SAMPLE_CAP - 1);
      pipe.expire(KEY.vitalSamples(vital), TTL.vitalSamples);
      pipe.hincrby(KEY.vitalPerRoute(vital), `${path}|${rating}`, 1);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }

  // Click (buttons + tagged links)
  if (eventType === "click") {
    const label = sanitizeKey(body.label, 60) || "(blank)";
    const path = sanitizeKey(body.pathname, 120) || "/";
    pipe.hincrby(KEY.clicks, label, 1);
    pipe.expire(KEY.clicks, TTL.clicks);
    pipe.hincrby(KEY.clicksPerRoute, `${path}|${label}`, 1);
    pipe.expire(KEY.clicksPerRoute, TTL.clicks);
    // Per-visitor timeline
    pipe.lpush(
      KEY.vidTimeline(visitorId),
      JSON.stringify({ t: now, type: "click", label, pathname: path }),
    );
    pipe.ltrim(KEY.vidTimeline(visitorId), 0, VID_TIMELINE_CAP - 1);
    pipe.expire(KEY.vidTimeline(visitorId), TTL.vidTimeline);
    pipe.zadd(KEY.vidsRecent, { score: now, member: visitorId });
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Outbound link clicks
  if (eventType === "outbound") {
    const host = sanitizeKey(body.host, 60) || "(unknown)";
    pipe.hincrby(KEY.outbound, host, 1);
    pipe.expire(KEY.outbound, TTL.clicks);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Rage clicks — frustration. Key by path + label so we can see WHERE.
  if (eventType === "rage-click") {
    const label = sanitizeKey(body.label, 60) || "(unknown)";
    const path = sanitizeKey(body.pathname, 120) || "/";
    pipe.hincrby(KEY.rageClicks, label, 1);
    pipe.hincrby(KEY.rageClicksPerRoute, `${path}|${label}`, 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Copy — what content users find worth copying
  if (eventType === "copy") {
    const path = sanitizeKey(body.pathname, 120) || "/";
    pipe.hincrby(KEY.copyPerRoute, path, 1);
    pipe.hincrby(KEY.copyEvents, "total", 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Offline — track occurrences, doesn't need path
  if (eventType === "offline") {
    pipe.hincrby(KEY.offlineCount, "total", 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }
  if (eventType === "online") {
    // Offline → online transition; just count as a separate bucket
    pipe.hincrby(KEY.offlineCount, "recovered", 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Funnel steps — one hash per funnel, field=step, value=count
  if (eventType === "funnel-step") {
    const funnel = sanitizeKey(body.funnel, 40);
    const step = sanitizeKey(body.step, 40);
    if (funnel && step) {
      pipe.hincrby(KEY.funnel(funnel), step, 1);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }

  // Search — aggregate query term; flag zero-result separately
  if (eventType === "search") {
    const query = sanitizeKey(body.query, 80);
    if (query) {
      pipe.hincrby(KEY.searchTerms, query, 1);
      pipe.expire(KEY.searchTerms, TTL.search);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }
  if (eventType === "search-zero-results") {
    const query = sanitizeKey(body.query, 80);
    if (query) {
      pipe.hincrby(KEY.searchZeroResults, query, 1);
      pipe.expire(KEY.searchZeroResults, TTL.search);
      await pipe.exec();
    }
    return NextResponse.json({ ok: true });
  }

  // AI feature usage
  if (eventType === "ai-usage") {
    const feature = sanitizeKey(body.feature, 40) || "(unknown)";
    pipe.hincrby(KEY.aiUsage, feature, 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Auth events — no PII, just event kind
  if (eventType === "auth") {
    const kind = sanitizeKey(body.kind, 30) || "(unknown)";
    pipe.hincrby(KEY.authEvents, kind, 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Form abandon — which form, which step, optional which field
  if (eventType === "form-abandon") {
    const form = sanitizeKey(body.form, 30) || "(unknown)";
    const step = sanitizeKey(body.step, 40) || "(unknown)";
    const field = sanitizeKey(body.field, 40);
    pipe.hincrby(KEY.formAbandon, `${form}|${step}`, 1);
    if (field) {
      // Tracking granular pe field: pe care input/textarea statea cursorul
      // cand a parasit pagina. Vede direct in dashboard care field e „greu".
      pipe.hincrby(KEY.formAbandonFields, `${form}|${field}`, 1);
    }
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // PWA events — prompt shown / accepted / declined
  if (eventType === "pwa-install-prompt" || eventType === "pwa-installed") {
    pipe.hincrby(KEY.pwaEvents, eventType, 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // AI vision routing acceptance — userul a primit o sugestie de la vision
  // model si a acceptat-o sau a inlocuit-o manual. Pereche cu telemetry
  // server-side (confidence + tip distribution) → vedem acceptance rate
  // per tip + per confidence bucket.
  if (eventType === "vision-acceptance") {
    const accepted = sanitizeKey(body.accepted, 10) || "no";
    const tip = sanitizeKey(body.tip, 30) || "(unknown)";
    pipe.hincrby(KEY.visionAcceptance, accepted, 1);
    pipe.hincrby(KEY.visionAcceptance, `${accepted}|${tip}`, 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Print — sesizare printed for offline submission
  if (eventType === "print") {
    pipe.hincrby(KEY.eventsTotal, "print", 1);
    await pipe.exec();
    return NextResponse.json({ ok: true });
  }

  // Generic custom event — fallback bucket
  pipe.hincrby(KEY.eventsTotal, eventType, 1);
  pipe.lpush(
    KEY.events,
    JSON.stringify({ t: now, type: eventType, country, city, userId: userId || null })
  );
  pipe.ltrim(KEY.events, 0, 199);
  pipe.expire(KEY.events, TTL.events);
  // Per-visitor timeline pentru orice event custom — capturăm extra
  // string/number props (max 4 keys) ca să avem context în timeline view.
  const extra: Record<string, string | number> = {};
  let count = 0;
  for (const [k, v] of Object.entries(body)) {
    if (k === "action" || k === "visitorId" || k === "eventType") continue;
    if (typeof v === "string" || typeof v === "number") {
      extra[k] = typeof v === "string" ? v.slice(0, 80) : v;
      count++;
      if (count >= 4) break;
    }
  }
  pipe.lpush(
    KEY.vidTimeline(visitorId),
    JSON.stringify({ t: now, type: eventType, ...extra }),
  );
  pipe.ltrim(KEY.vidTimeline(visitorId), 0, VID_TIMELINE_CAP - 1);
  pipe.expire(KEY.vidTimeline(visitorId), TTL.vidTimeline);
  pipe.zadd(KEY.vidsRecent, { score: now, member: visitorId });
  await pipe.exec();
  return NextResponse.json({ ok: true });
}

async function handleSummary() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!analyticsRedis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });

  const d = today();
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const m = monthKey();
  const w = weekKey();

  // E3 — last 7 days for DAU sparkline. KEY.dau(date) e un Set cu vid-uri
  // unice per zi; scard ne dă numărul de vizitatori unici. TTL 90 zile,
  // așa că 7 zile sunt mereu disponibile.
  const last7Dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    last7Dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }

  const VITALS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
  // Capture the non-null reference so the flatMap closure below keeps
  // the narrowed type (TS widens back to possibly-null inside callbacks).
  const r = analyticsRedis;

  const [
    total,
    routes,
    referrers,
    countries,
    cities,
    languages,
    hourly,
    perf,
    errors,
    errorPaths,
    eventsTotal,
    scrollDepth,
    utmSource,
    utmMedium,
    utmCampaign,
    landingPages,
    dauToday,
    dauYesterday,
    wauCount,
    mauCount,
    topUsersRaw,
    eventsStreamRaw,
    clicks,
    outbound,
    rageClicks,
    searchTerms,
    searchZero,
    aiUsage,
    authEvents,
    formAbandon,
    formAbandonFields,
    copyEvents,
    pwaEvents,
    visionConfidence,
    visionTips,
    visionAuthorities,
    visionAcceptance,
    sessionsPerReferrer,
    nonBouncesPerReferrer,
    ...vitalsAndExtras
  ] = await Promise.all([
    analyticsRedis.hgetall<Record<string, string>>(KEY.total),
    analyticsRedis.hgetall<Record<string, string>>(KEY.routes),
    analyticsRedis.hgetall<Record<string, string>>(KEY.referrers),
    analyticsRedis.hgetall<Record<string, string>>(KEY.countries),
    analyticsRedis.hgetall<Record<string, string>>(KEY.cities),
    analyticsRedis.hgetall<Record<string, string>>(KEY.languages),
    analyticsRedis.hgetall<Record<string, string>>(KEY.hourly),
    analyticsRedis.hgetall<Record<string, string>>(KEY.perf),
    analyticsRedis.hgetall<Record<string, string>>(KEY.errors),
    analyticsRedis.hgetall<Record<string, string>>(KEY.errorPaths),
    analyticsRedis.hgetall<Record<string, string>>(KEY.eventsTotal),
    analyticsRedis.hgetall<Record<string, string>>(KEY.scrollDepth),
    analyticsRedis.hgetall<Record<string, string>>(KEY.utmSource),
    analyticsRedis.hgetall<Record<string, string>>(KEY.utmMedium),
    analyticsRedis.hgetall<Record<string, string>>(KEY.utmCampaign),
    analyticsRedis.hgetall<Record<string, string>>(KEY.landingPages),
    analyticsRedis.scard(KEY.dau(d)),
    analyticsRedis.scard(KEY.dau(yesterdayStr)),
    analyticsRedis.scard(KEY.wau(w)),
    analyticsRedis.scard(KEY.mau(m)),
    analyticsRedis.zrange(KEY.topUsers, 0, 19, { rev: true, withScores: true }),
    analyticsRedis.lrange(KEY.events, 0, 49),
    analyticsRedis.hgetall<Record<string, string>>(KEY.clicks),
    analyticsRedis.hgetall<Record<string, string>>(KEY.outbound),
    analyticsRedis.hgetall<Record<string, string>>(KEY.rageClicks),
    analyticsRedis.hgetall<Record<string, string>>(KEY.searchTerms),
    analyticsRedis.hgetall<Record<string, string>>(KEY.searchZeroResults),
    analyticsRedis.hgetall<Record<string, string>>(KEY.aiUsage),
    analyticsRedis.hgetall<Record<string, string>>(KEY.authEvents),
    analyticsRedis.hgetall<Record<string, string>>(KEY.formAbandon),
    analyticsRedis.hgetall<Record<string, string>>(KEY.formAbandonFields),
    analyticsRedis.hgetall<Record<string, string>>(KEY.copyEvents),
    analyticsRedis.hgetall<Record<string, string>>(KEY.pwaEvents),
    analyticsRedis.hgetall<Record<string, string>>(KEY.visionConfidence),
    analyticsRedis.hgetall<Record<string, string>>(KEY.visionTips),
    analyticsRedis.hgetall<Record<string, string>>(KEY.visionAuthorities),
    analyticsRedis.hgetall<Record<string, string>>(KEY.visionAcceptance),
    analyticsRedis.hgetall<Record<string, string>>(KEY.sessionsPerReferrer),
    analyticsRedis.hgetall<Record<string, string>>(KEY.nonBouncesPerReferrer),
    // One (ratings, samples) pair per Web Vital — appended to the tuple
    ...VITALS.flatMap((v) => [
      r.hgetall<Record<string, string>>(KEY.vitalRating(v)),
      r.lrange(KEY.vitalSamples(v), 0, -1),
    ]),
    // Insights noi (mai 2026) — agregate la nivel path pentru
    // a permite secțiuni „Top X pe path" în dashboard:
    analyticsRedis.hgetall<Record<string, string>>(KEY.rageClicksPerRoute),
    // LCP per route — cel mai relevant vital pentru speed perception
    analyticsRedis.hgetall<Record<string, string>>(KEY.vitalPerRoute("LCP")),
  ]);

  // Feedback messages + newsletter subscribers — stored in separate
  // Redis lists so we can read them without polluting the main tuple.
  const [feedbackList, feedbackCounts, newsletterList, newsletterCounts] =
    await Promise.all([
      r.lrange("civia:feedback:messages", 0, 49),
      r.hgetall<Record<string, string>>("civia:feedback:counts"),
      r.lrange("civia:newsletter:subscribers", 0, 99),
      r.hgetall<Record<string, string>>("civia:newsletter:counts"),
    ]);

  const parseList = <T,>(raw: (string | null)[]): T[] =>
    (raw || [])
      .map((s) => {
        try {
          return typeof s === "string" ? (JSON.parse(s) as T) : (s as T);
        } catch {
          return null;
        }
      })
      .filter((x): x is T => x !== null);

  type FeedbackEntry = {
    t: number;
    kind: string;
    message: string;
    email: string | null;
    userId: string | null;
    country: string | null;
    pathname: string | null;
  };
  type NewsletterEntry = {
    t: number;
    email: string;
    sectors: string[];
    country: string | null;
  };
  const feedback = parseList<FeedbackEntry>(feedbackList);
  const newsletter = parseList<NewsletterEntry>(newsletterList);

  // Funnel is a separate fetch (one HGETALL per named funnel) since the
  // set of funnels is enumerated ahead of time.
  const FUNNELS = ["sesizare-create"] as const;
  const funnelData: Record<string, Record<string, string>> = {};
  for (const f of FUNNELS) {
    const data = await analyticsRedis.hgetall<Record<string, string>>(KEY.funnel(f));
    funnelData[f] = data ?? {};
  }

  // Compute p50/p75/p95 from the sampled values for each vital
  // Split vitalsAndExtras: primele VITALS.length*2 sunt vitalele
  // (ratings + samples), apoi 2 entries pentru rage-per-route + LCP-per-route.
  const vitalsAll = vitalsAndExtras.slice(0, VITALS.length * 2);
  const rageClicksPerRoute =
    (vitalsAndExtras[VITALS.length * 2] as Record<string, string> | null) ?? {};
  const lcpPerRoute =
    (vitalsAndExtras[VITALS.length * 2 + 1] as Record<string, string> | null) ?? {};

  const vitals: Record<string, {
    p50: number;
    p75: number;
    p95: number;
    rating: Record<string, number>;
    samples: number;
  }> = {};
  for (let i = 0; i < VITALS.length; i++) {
    const name = VITALS[i]!;
    const ratingRaw = (vitalsAll[i * 2] as Record<string, string> | null) ?? {};
    const samplesRaw = (vitalsAll[i * 2 + 1] as string[] | null) ?? [];
    const values = samplesRaw
      .map((s) => parseFloat(s))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const pct = (p: number) => {
      if (values.length === 0) return 0;
      const idx = Math.min(values.length - 1, Math.floor(values.length * p));
      return values[idx] ?? 0;
    };
    const rating: Record<string, number> = {};
    for (const [k, v] of Object.entries(ratingRaw)) rating[k] = parseInt(v) || 0;
    vitals[name] = {
      p50: Math.round(pct(0.5) * 1000) / 1000,
      p75: Math.round(pct(0.75) * 1000) / 1000,
      p95: Math.round(pct(0.95) * 1000) / 1000,
      rating,
      samples: values.length,
    };
  }

  const toNum = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? parseInt(v) || 0 : 0);

  const loadTotal = toNum((perf as Record<string, unknown> | null)?.load_total);
  const loadCount = toNum((perf as Record<string, unknown> | null)?.load_count);
  const timeTotal = toNum((perf as Record<string, unknown> | null)?.time_total);
  const timeCount = toNum((perf as Record<string, unknown> | null)?.time_count);
  const avgLoadTime = loadCount > 0 ? Math.round(loadTotal / loadCount) : 0;
  const avgTimeOnPage = timeCount > 0 ? Math.round(timeTotal / timeCount) : 0;

  const mau = Number(mauCount) || 0;
  const dau = Number(dauToday) || 0;
  const stickiness = mau > 0 && dau <= mau ? Math.round((dau / mau) * 100) : 0;

  // Parse ZRANGE withScores — upstash returns alternating [member, score, ...]
  const topUsers: { id: string; views: number }[] = [];
  if (Array.isArray(topUsersRaw)) {
    for (let i = 0; i < topUsersRaw.length; i += 2) {
      topUsers.push({
        id: String(topUsersRaw[i]),
        views: Number(topUsersRaw[i + 1]) || 0,
      });
    }
  }

  const eventsStream = (eventsStreamRaw || [])
    .map((e) => {
      try {
        return typeof e === "string" ? JSON.parse(e) : e;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    total: total || {},
    routes: routes || {},
    referrers: referrers || {},
    countries: countries || {},
    cities: cities || {},
    languages: languages || {},
    hourly: hourly || {},
    errors: errors || {},
    errorPaths: errorPaths || {},
    eventsTotal: eventsTotal || {},
    scrollDepth: scrollDepth || {},
    utmSource: utmSource || {},
    utmMedium: utmMedium || {},
    utmCampaign: utmCampaign || {},
    landingPages: landingPages || {},
    today: { dau },
    yesterday: { dau: Number(dauYesterday) || 0 },
    wau: Number(wauCount) || 0,
    mau,
    stickiness,
    topUsers,
    eventsStream,
    perf: { avgLoadTime, avgTimeOnPage },
    // New sections
    vitals,
    clicks: clicks || {},
    outbound: outbound || {},
    rageClicks: rageClicks || {},
    searchTerms: searchTerms || {},
    searchZero: searchZero || {},
    aiUsage: aiUsage || {},
    authEvents: authEvents || {},
    formAbandon: formAbandon || {},
    formAbandonFields: formAbandonFields || {},
    copyEvents: copyEvents || {},
    pwaEvents: pwaEvents || {},
    visionConfidence: visionConfidence || {},
    visionTips: visionTips || {},
    visionAuthorities: visionAuthorities || {},
    visionAcceptance: visionAcceptance || {},
    sessionsPerReferrer: sessionsPerReferrer || {},
    nonBouncesPerReferrer: nonBouncesPerReferrer || {},
    funnels: funnelData,
    // Insights noi (mai 2026):
    // - rageClicksPerRoute: chei „path|label", values count → top
    //   pages cu cei mai mulți rage clicks
    // - lcpPerRoute: chei „path|rating", values count → cele mai
    //   lente pagini după proporția de „poor" LCP
    // - trendDau7d: ultimele 7 zile DAU pentru sparkline (vechi → recent)
    rageClicksPerRoute: rageClicksPerRoute || {},
    lcpPerRoute: lcpPerRoute || {},
    trendDau7d: await Promise.all(
      last7Dates.map(async (date) => Number((await analyticsRedis!.scard(KEY.dau(date))) ?? 0)),
    ),
    feedback,
    feedbackCounts: feedbackCounts || {},
    newsletter,
    newsletterCounts: newsletterCounts || {},
    serverTime: Date.now(),
  }, {
    // E1 — short-term private cache. Auto-refresh dashboard la 30s
    // poate hit cache-ul browser timp de 20s între request-uri ca să
    // economisim un fetch/min. private = doar admin browser, nu CDN.
    headers: {
      "Cache-Control": "private, max-age=20, stale-while-revalidate=10",
    },
  });
}

async function handleUser(body: Record<string, unknown>) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!analyticsRedis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  const userId = sanitizeId(body.userId);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const [meta, routes, countries, days] = await Promise.all([
    analyticsRedis.hgetall<Record<string, string>>(KEY.userMeta(userId)),
    analyticsRedis.hgetall<Record<string, string>>(KEY.userRoutes(userId)),
    analyticsRedis.hgetall<Record<string, string>>(KEY.userCountries(userId)),
    analyticsRedis.hgetall<Record<string, string>>(KEY.userDays(userId)),
  ]);
  return NextResponse.json({ ok: true, userId, meta: meta || {}, routes: routes || {}, countries: countries || {}, days: days || {} });
}

/**
 * GET /api/analytics?action=sessions-list&limit=50&offset=0
 *
 * Returnează lista vizitatorilor recenți cu meta (device fingerprint).
 * Sortat descendent după last_seen. Folosit pe /admin/analytics/sessions.
 */
async function handleSessionsList(body: Record<string, unknown>) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!analyticsRedis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  const limit = Math.max(1, Math.min(100, Number(body.limit) || 50));
  const offset = Math.max(0, Number(body.offset) || 0);

  // ZRANGE descending = most-recent-first.
  const vids = (await analyticsRedis.zrange(KEY.vidsRecent, offset, offset + limit - 1, {
    rev: true,
    withScores: true,
  })) as Array<string | number>;

  // vids = [vid1, score1, vid2, score2, ...] when withScores
  const sessions: Array<{ vid: string; lastSeen: number; meta: Record<string, string> }> = [];
  const fetches: Array<Promise<Record<string, string> | null>> = [];
  const vidList: string[] = [];
  const scoreList: number[] = [];
  for (let i = 0; i < vids.length; i += 2) {
    const vid = String(vids[i]);
    const score = Number(vids[i + 1]);
    vidList.push(vid);
    scoreList.push(score);
    fetches.push(analyticsRedis.hgetall<Record<string, string>>(KEY.vidMeta(vid)));
  }
  const metas = await Promise.all(fetches);
  for (let i = 0; i < vidList.length; i++) {
    sessions.push({
      vid: vidList[i]!,
      lastSeen: scoreList[i]!,
      meta: metas[i] || {},
    });
  }

  const totalCount = await analyticsRedis.zcard(KEY.vidsRecent);
  return NextResponse.json({ ok: true, sessions, totalCount });
}

/**
 * GET /api/analytics?action=session-timeline&vid=<vid>
 *
 * Returnează timeline-ul complet (ultimele 200 evenimente) pentru un vid +
 * meta-ul lui. Folosit pe /admin/analytics/sessions/[vid].
 */
async function handleSessionTimeline(body: Record<string, unknown>) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!analyticsRedis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  const vid = sanitizeId(body.vid);
  if (!vid) return NextResponse.json({ error: "vid required" }, { status: 400 });

  const [rawEvents, meta] = await Promise.all([
    analyticsRedis.lrange(KEY.vidTimeline(vid), 0, VID_TIMELINE_CAP - 1),
    analyticsRedis.hgetall<Record<string, string>>(KEY.vidMeta(vid)),
  ]);

  // Events sunt JSON strings (Upstash Redis returnează deja parsate ca obiect
  // dacă sunt JSON-valid sau ca string altfel). Normalizez.
  const events: Array<Record<string, string | number>> = [];
  for (const raw of rawEvents) {
    if (!raw) continue;
    if (typeof raw === "object") {
      events.push(raw as Record<string, string | number>);
    } else if (typeof raw === "string") {
      try {
        events.push(JSON.parse(raw));
      } catch { /* skip corrupt entries */ }
    }
  }

  return NextResponse.json({ ok: true, vid, meta: meta || {}, events });
}

/**
 * GET /api/analytics?action=weekly-compare
 *
 * Compară săptămâna asta vs săptămâna trecută:
 *   - DAU mediu, WAU, total views, top routes, top errors.
 *   - Pentru fiecare metric: { current, previous, delta, deltaPct }.
 */
async function handleWeeklyCompare() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!analyticsRedis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });

  // Construct day strings pentru ultimele 14 zile.
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const thisWeek = days.slice(0, 7);
  const lastWeek = days.slice(7, 14);

  async function avgDauForDays(daysList: string[]): Promise<number> {
    const counts = await Promise.all(daysList.map((d) => analyticsRedis!.scard(KEY.dau(d))));
    const sum = counts.reduce((a: number, b) => a + (Number(b) || 0), 0);
    return Math.round(sum / Math.max(1, counts.length));
  }
  async function viewsForDays(daysList: string[]): Promise<number> {
    const dailyViews = await Promise.all(
      daysList.map(async (d) => {
        const v = await analyticsRedis!.hget<string | number>(KEY.daily(d), "views");
        return Number(v) || 0;
      }),
    );
    return dailyViews.reduce((a, b) => a + b, 0);
  }

  const [dauThis, dauLast, viewsThis, viewsLast] = await Promise.all([
    avgDauForDays(thisWeek),
    avgDauForDays(lastWeek),
    viewsForDays(thisWeek),
    viewsForDays(lastWeek),
  ]);

  function delta(curr: number, prev: number) {
    const d = curr - prev;
    const pct = prev > 0 ? Math.round((d / prev) * 100) : null;
    return { current: curr, previous: prev, delta: d, deltaPct: pct };
  }

  return NextResponse.json({
    ok: true,
    weekRange: { thisWeek, lastWeek },
    avgDau: delta(dauThis, dauLast),
    totalViews: delta(viewsThis, viewsLast),
  });
}

async function handleExclude(body: Record<string, unknown>) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!analyticsRedis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  const userId = sanitizeId(body.userId);
  const mode = sanitizeStr(body.mode, 10);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (mode === "remove") {
    await analyticsRedis.srem(KEY.excluded, userId);
  } else {
    await analyticsRedis.sadd(KEY.excluded, userId);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // Origin check (CSRF) — allow same-origin and whitelisted.
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = sanitizeStr(body.action, 20);
  try {
    if (action === "track") return await handleTrack(req, body);
    if (action === "track-batch") return await handleTrackBatch(req, body);
    if (action === "summary") return await handleSummary();
    if (action === "user") return await handleUser(body);
    if (action === "exclude") return await handleExclude(body);
    if (action === "sessions-list") return await handleSessionsList(body);
    if (action === "session-timeline") return await handleSessionTimeline(body);
    if (action === "weekly-compare") return await handleWeeklyCompare();
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
