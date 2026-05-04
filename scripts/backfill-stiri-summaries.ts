/**
 * Backfill AI summaries pentru știrile fără cache.
 *
 * Audit (5/4/2026): doar 65.8% din 1922 știri aveau ai_summary —
 * pre-gen din /api/stiri/fetch acoperă top 20 per run, dar articolele
 * vechi rămân fără.  La primul user care deschide /stiri/[id] pe un
 * articol vechi, client component-ul AiSummary trigger-uiește
 * /synthesize cu loading spinner, dar e mai bine să pre-genrate
 * cele mai vizitate.
 *
 * Strategie: limitez la cele mai RECENTE N articole fără summary
 * (pentru că archive policy oricum șterge articole > 3 zile).
 * Concurrency 3 ca să nu blow rate-limit Gemini/Groq.
 *
 * Run: npx tsx scripts/backfill-stiri-summaries.ts [--limit=200]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getOrGenerateAiSummary } from "../src/lib/stiri/ai-summary";
import { AI_SUMMARY_VERSION } from "../src/lib/ai/synthesis-version";

const CONCURRENCY = 3;

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "200", 10) : 200;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key);

  // Pull stiri fără ai_summary la versiunea curentă, ordonat după
  // recency (cele mai noi întâi — cel mai probabil să fie deschise).
  const { data, error } = await supa
    .from("stiri_cache")
    .select("id, url, title, excerpt, content, source, ai_summary, ai_summary_version")
    .or(`ai_summary.is.null,ai_summary_version.lt.${AI_SUMMARY_VERSION}`)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    url: string;
    title: string;
    excerpt: string | null;
    content: string | null;
    source: string;
    ai_summary: string | null;
    ai_summary_version: number | null;
  }>;
  console.log(`📰 Backfill ${rows.length} știri fără AI summary la v${AI_SUMMARY_VERSION}`);
  if (rows.length === 0) {
    console.log("Toate au summary la zi. Nimic de făcut.");
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const t0 = Date.now();

  // Worker pool concurrency 3
  const queue = [...rows];
  const worker = async (id: number) => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const idx = rows.length - queue.length;
      try {
        const result = await getOrGenerateAiSummary(next);
        if (result) {
          ok++;
          console.log(`  [${idx}/${rows.length}] ✓ ${next.source} — ${next.title.slice(0, 60)}`);
        } else {
          skipped++;
          console.log(`  [${idx}/${rows.length}] ⊘ ${next.source} — synthesis returned null (skipped)`);
        }
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : "?";
        console.log(`  [${idx}/${rows.length}] ✗ ${next.source} — ${msg.slice(0, 80)}`);
      }
      // Mic delay între request-uri să fim politicoși cu rate-limit-urile
      await new Promise((r) => setTimeout(r, 200));
    }
    void id;
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  const ms = Date.now() - t0;
  console.log(
    `\n✅ Backfill complet în ${(ms / 1000).toFixed(1)}s. ` +
      `Generate: ${ok}, Skipped: ${skipped}, Failed: ${failed}.`,
  );
}

main().catch((e) => {
  console.error("Crash:", e);
  process.exit(1);
});
