/**
 * Backfill stiri_cache.media — scrape galerie media (poze + videouri) pentru
 * toate stirile existente fără media (sau cu array gol).
 *
 * Reuses fetchArticleMedia din src/lib/stiri/rss.ts. Rate-limit serial cu
 * 500ms delay între requests ca să nu hammer-uim site-urile mici.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { fetchArticleMedia } from "../src/lib/stiri/rss";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // Toate stirile care n-au media sau au media=[]
  const { data, error } = await sa
    .from("stiri_cache")
    .select("id, url, source, title, media")
    .order("published_at", { ascending: false });

  if (error) {
    console.log("❌", error.message);
    return;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    url: string;
    source: string;
    title: string;
    media: unknown[] | null;
  }>;
  const toFix = rows.filter((r) => !Array.isArray(r.media) || r.media.length === 0);
  console.log(`Found ${toFix.length} stiri without media (of ${rows.length} total)\n`);

  let updated = 0;
  let empty = 0;

  for (const r of toFix) {
    process.stdout.write(`[${r.source}] ${r.title.slice(0, 60)}... `);
    try {
      const media = await fetchArticleMedia(r.url);
      if (media.length === 0) {
        console.log("0 items");
        empty += 1;
      } else {
        const { error: upErr } = await sa
          .from("stiri_cache")
          .update({ media })
          .eq("id", r.id);
        if (upErr) {
          console.log("❌ DB:", upErr.message);
        } else {
          console.log(`✓ ${media.length} items`);
          updated += 1;
        }
      }
    } catch (e) {
      console.log("✗", e instanceof Error ? e.message : "unknown");
    }
    // Polite delay
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nUpdated: ${updated}, Empty: ${empty}, Total: ${toFix.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
