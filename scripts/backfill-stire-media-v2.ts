/**
 * v2 Backfill — re-scrape ALL stiri cu noul scraper (filtre îmbunătățite)
 * + AI captions via Groq Vision pentru fiecare imagine.
 *
 * Run: npx tsx scripts/backfill-stire-media-v2.ts
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { fetchArticleMedia } from "../src/lib/stiri/rss";
import { captionMediaBatch } from "../src/lib/stiri/caption-media";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const onlyId = process.argv[2];

  let query = sa
    .from("stiri_cache")
    .select("id, url, source, title, excerpt, image_url")
    .order("published_at", { ascending: false });
  if (onlyId) query = query.eq("id", onlyId);

  const { data, error } = await query;
  if (error) {
    console.log("❌", error.message);
    return;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    url: string;
    source: string;
    title: string;
    excerpt: string | null;
    image_url: string | null;
  }>;
  console.log(`Processing ${rows.length} stiri\n`);

  let updated = 0;
  let empty = 0;
  let captioned = 0;

  for (const r of rows) {
    process.stdout.write(`[${r.source}] ${r.title.slice(0, 55)}... `);
    try {
      let media = await fetchArticleMedia(r.url, r.image_url);
      if (media.length === 0) {
        console.log("0 items");
        empty += 1;
        // Clear orice junk vechi
        await sa.from("stiri_cache").update({ media: [] }).eq("id", r.id);
        continue;
      }

      // AI captions pentru fiecare imagine — Groq Vision
      try {
        const captionedMedia = await captionMediaBatch(media, r.title, r.excerpt);
        const newCaptions = captionedMedia.filter(
          (m, i) => media[i] && m.caption && m.caption !== media[i]?.caption,
        ).length;
        if (newCaptions > 0) captioned += newCaptions;
        media = captionedMedia;
      } catch (e) {
        console.log(
          ` (caption err: ${e instanceof Error ? e.message.slice(0, 40) : "unknown"})`,
        );
      }

      const { error: upErr } = await sa
        .from("stiri_cache")
        .update({ media })
        .eq("id", r.id);
      if (upErr) {
        console.log("❌ DB:", upErr.message);
      } else {
        const withCaption = media.filter((m) => m.caption && m.caption.length > 10).length;
        console.log(`✓ ${media.length} items, ${withCaption} captionate`);
        updated += 1;
      }
    } catch (e) {
      console.log("✗", e instanceof Error ? e.message : "unknown");
    }
    // Polite delay între articole (Groq + politeness pentru site-uri)
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(
    `\nUpdated: ${updated}, Empty: ${empty}, Total: ${rows.length}, New captions: ${captioned}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
