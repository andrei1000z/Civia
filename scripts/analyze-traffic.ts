import { config } from "dotenv";
config({ path: ".env.local" });
import { Redis } from "@upstash/redis";

const r = Redis.fromEnv();

async function topN(
  key: string,
  n: number,
  truncate?: number,
): Promise<[string, number][]> {
  const h = await r.hgetall<Record<string, string>>(key);
  if (!h) return [];
  return Object.entries(h)
    .map(([k, v]) => [k, Number(v)] as [string, number])
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => [truncate ? k.slice(0, truncate) : k, v]);
}

function pad(s: string | number, n: number): string {
  const t = String(s);
  return t.length >= n ? t : " ".repeat(n - t.length) + t;
}

async function main() {
  console.log("\n========= TOTAL TRAFFIC SUMMARY =========");
  const total = await r.hgetall<Record<string, string>>("civia:analytics:total");
  for (const [k, v] of Object.entries(total ?? {})) console.log(`  ${k.padEnd(20)} ${v}`);

  console.log("\n========= TOP 25 ROUTES (pageviews) =========");
  for (const [k, v] of await topN("civia:analytics:routes", 25)) {
    console.log(`  ${pad(v, 6)}  ${k}`);
  }

  console.log("\n========= TOP 15 REFERRERS =========");
  for (const [k, v] of await topN("civia:analytics:referrers", 15, 80)) {
    console.log(`  ${pad(v, 5)}  ${k}`);
  }

  console.log("\n========= TOP 15 LANDING PAGES =========");
  for (const [k, v] of await topN("civia:analytics:landing-pages", 15)) {
    console.log(`  ${pad(v, 5)}  ${k}`);
  }

  console.log("\n========= TOP 10 COUNTRIES =========");
  for (const [k, v] of await topN("civia:analytics:countries", 10)) {
    console.log(`  ${pad(v, 5)}  ${k}`);
  }

  console.log("\n========= TOP 15 CITIES =========");
  for (const [k, v] of await topN("civia:analytics:cities", 15)) {
    console.log(`  ${pad(v, 5)}  ${k}`);
  }

  console.log("\n========= TOP 20 ERROR PATHS =========");
  for (const [k, v] of await topN("civia:analytics:error-paths", 20)) {
    console.log(`  ${pad(v, 5)}  ${k}`);
  }

  console.log("\n========= TOP 20 ERROR MESSAGES =========");
  for (const [k, v] of await topN("civia:analytics:errors", 20, 140)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= TOP 10 RAGE CLICKS =========");
  for (const [k, v] of await topN("civia:analytics:rage-clicks", 10, 80)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= TOP 10 RAGE CLICKS PER ROUTE =========");
  for (const [k, v] of await topN("civia:analytics:rage-clicks-per-route", 10, 80)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= TOP 10 SEARCH TERMS =========");
  for (const [k, v] of await topN("civia:analytics:search", 10)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= TOP 10 SEARCH ZERO-RESULT =========");
  for (const [k, v] of await topN("civia:analytics:search-zero", 10)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= TOP 10 404 PATHS =========");
  for (const [k, v] of await topN("civia:analytics:404-paths", 10)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= TOP 10 404 REFERRERS =========");
  for (const [k, v] of await topN("civia:analytics:404-referrers", 10, 80)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= FORM ABANDON =========");
  for (const [k, v] of await topN("civia:analytics:form-abandon", 15)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= FUNNEL: sesizare =========");
  const f1 = await r.hgetall<Record<string, string>>("civia:analytics:funnel:sesizare");
  if (f1) for (const [k, v] of Object.entries(f1)) console.log(`  ${pad(v, 5)}  ${k}`);

  console.log("\n========= FUNNEL: petitie =========");
  const f2 = await r.hgetall<Record<string, string>>("civia:analytics:funnel:petitie");
  if (f2) for (const [k, v] of Object.entries(f2)) console.log(`  ${pad(v, 5)}  ${k}`);

  console.log("\n========= AI USAGE =========");
  for (const [k, v] of await topN("civia:analytics:ai-usage", 15)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= AUTH EVENTS =========");
  for (const [k, v] of await topN("civia:analytics:auth", 10)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= COPY EVENTS =========");
  for (const [k, v] of await topN("civia:analytics:copy", 10)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= OUTBOUND LINKS =========");
  for (const [k, v] of await topN("civia:analytics:outbound", 10, 100)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= WEB VITALS =========");
  for (const vital of ["LCP", "INP", "CLS", "FCP", "TTFB"]) {
    const r1 = await r.hgetall<Record<string, string>>(`civia:analytics:vital:${vital}:rating`);
    if (r1 && Object.keys(r1).length > 0) {
      const total = Object.values(r1).reduce((a, b) => a + Number(b), 0);
      const good = Number(r1.good ?? 0);
      const ni = Number(r1["needs-improvement"] ?? 0);
      const poor = Number(r1.poor ?? 0);
      const goodPct = ((good / total) * 100).toFixed(1);
      const poorPct = ((poor / total) * 100).toFixed(1);
      console.log(`  ${vital.padEnd(5)} good=${good} (${goodPct}%)  needs-imp=${ni}  poor=${poor} (${poorPct}%)  total=${total}`);
    }
  }

  console.log("\n========= LCP PER ROUTE (poor) =========");
  for (const [k, v] of await topN("civia:analytics:lcp-per-route", 15, 80)) {
    if (k.includes("|poor")) console.log(`  ${pad(v, 4)}  ${k}`);
  }

  console.log("\n========= PWA EVENTS =========");
  for (const [k, v] of await topN("civia:analytics:pwa-events", 8)) {
    console.log(`  ${pad(v, 4)}  ${k}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
