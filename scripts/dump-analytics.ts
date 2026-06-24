/**
 * 2026-06-24 — dump READ-ONLY al datelor reale de analytics (Cloudflare D1). Nu scrie.
 *   npx tsx scripts/dump-analytics.ts
 */
import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: ".env.local" }); // are CLOUDFLARE_API_TOKEN
if (existsSync(".env.vercel.local")) config({ path: ".env.vercel.local" });

function pad(n: number) { return String(n).padStart(2, "0"); }
function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const d = new Date(now - i * 86400000);
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

async function main() {
  const { analyticsRedis, KEY } = await import("@/lib/analytics/redis");
  if (!analyticsRedis) { console.error("analyticsRedis e null — lipsește CLOUDFLARE_API_TOKEN?"); process.exit(1); }
  const r = analyticsRedis;

  const hash = async (label: string, key: string, top = 40) => {
    try {
      const h = await r.hgetall<Record<string, string>>(key);
      if (h && Object.keys(h).length) {
        const sorted = Object.entries(h).sort((a, b) => Number(b[1]) - Number(a[1]));
        console.log(`\n## ${label}`);
        for (const [k, v] of sorted.slice(0, top)) console.log(`   ${String(v).padStart(8)}  ${k}`);
      }
    } catch (e) { console.log(`   (${label}: ${(e as Error).message})`); }
  };
  const zset = async (label: string, key: string, top = 25) => {
    try {
      const z = await r.zrange(key, 0, top - 1, { rev: true, withScores: true });
      if (z.length) {
        console.log(`\n## ${label}`);
        for (let i = 0; i < z.length; i += 2) console.log(`   ${String(z[i + 1]).padStart(8)}  ${z[i]}`);
      }
    } catch (e) { console.log(`   (${label}: ${(e as Error).message})`); }
  };

  console.log("===== CIVIA ANALYTICS — DATE REALE =====");
  await hash("TOTAL (device/browser/os/display/viewport/color/conn + views)", KEY.total);
  await zset("ROUTES (top pagini)", KEY.routes, 30);
  await zset("REFERRERS", KEY.referrers);
  await zset("COUNTRIES", KEY.countries);
  await zset("CITIES", KEY.cities);
  await zset("LANGUAGES", KEY.languages);
  await zset("LANDING PAGES", KEY.landingPages, 20);
  await zset("UTM SOURCE", KEY.utmSource);
  await zset("UTM MEDIUM", KEY.utmMedium);
  await zset("UTM CAMPAIGN", KEY.utmCampaign);

  console.log("\n----- COMPORTAMENT (events) -----");
  await hash("EVENTS TOTAL (custom events)", KEY.eventsTotal);
  await zset("EVENTS (zset)", KEY.events, 40);

  console.log("\n----- ERORI + PERF -----");
  await hash("ERRORS", KEY.errors);
  await zset("ERROR PATHS", KEY.errorPaths);
  await zset("ERROR SOURCES", KEY.errorSources);
  await hash("PERF (web vitals)", KEY.perf);
  await hash("SCROLL DEPTH", KEY.scrollDepth);

  console.log("\n----- HOURLY + DAU + DAILY -----");
  await hash("HOURLY", KEY.hourly, 24);
  console.log("\n## DAU (ultimele 14 zile)");
  for (const d of lastDays(14)) {
    try { const v = await r.get<string>(KEY.dau(d)); if (v != null) console.log(`   ${String(v).padStart(8)}  ${d}`); } catch { /* */ }
  }
  console.log("\n## DAILY pageviews (ultimele 10 zile)");
  for (const d of lastDays(10)) await hash(`daily ${d}`, KEY.daily(d), 8);

  console.log("\n----- TOP USERS -----");
  await zset("TOP USERS (vizite)", KEY.topUsers, 15);
  console.log("\n===== sfârșit =====");
}
main();
