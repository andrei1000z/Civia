/**
 * Re-caption ONLY items unde caption == title sau caption e generic.
 * Mai rapid decât backfill complet (skip items deja bune).
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { captionMediaBatch } from "../src/lib/stiri/caption-media";
import type { MediaItem } from "../src/lib/stiri/rss";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data, error } = await sa
    .from("stiri_cache")
    .select("id, title, excerpt, media")
    .order("published_at", { ascending: false });
  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    excerpt: string | null;
    media: MediaItem[] | null;
  }>;

  let candidates = 0;
  let updated = 0;
  let newCaptions = 0;

  for (const row of rows) {
    if (!row.media || row.media.length === 0) continue;
    const titleTrim = row.title.trim();
    const hasIssue = row.media.some((m) => {
      const c = m.caption?.trim() ?? "";
      if (!c) return false;
      if (c === titleTrim) return true;
      if (/^(?:image|imagine|foto|persoană|persoane|o persoană|un obiect|o clădire|logo|icon|share|follow)(?:\b|$)/i.test(c)) return true;
      if (/^(?:foto|imagine|sursă|sursa|credit|image)[:.\s]/i.test(c)) return true;
      return false;
    });
    if (!hasIssue) continue;
    candidates++;

    const before = row.media.map((m) => m.caption ?? "").join("|");
    const next = await captionMediaBatch(row.media, row.title, row.excerpt);
    const after = next.map((m) => m.caption ?? "").join("|");

    if (before !== after) {
      // Count new captions
      for (let i = 0; i < next.length; i++) {
        if ((next[i]?.caption ?? "") !== (row.media[i]?.caption ?? "")) {
          newCaptions++;
        }
      }
      await sa
        .from("stiri_cache")
        .update({ media: next })
        .eq("id", row.id);
      updated++;
      console.log(`[${row.title.slice(0, 60)}] ✓ updated`);
    } else {
      console.log(`[${row.title.slice(0, 60)}] - no change`);
    }
    // Polite delay
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nCandidates: ${candidates}, Updated: ${updated}, New captions: ${newCaptions}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
