/**
 * Re-aplică isRelevantImage check peste tot media existent ca să curățăm
 * URLs care au scăpat anterior (eg. $%7BimagePath%7D, double-slash, etc.).
 *
 * Folosește doar URL-pattern checks (NU re-scrape sau AI), foarte rapid.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import type { MediaItem } from "../src/lib/stiri/rss";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function looksBroken(url: string): boolean {
  // Template placeholders în toate formele
  if (/%[a-z_]+%|\{\{[^}]+\}\}|\{[a-z_]+\}|\$\{[^}]+\}|\$%7B[^%]*%7D/i.test(url)) return true;
  // data:, blob:, about:, javascript:
  if (/^(?:data|blob|about|javascript):/i.test(url)) return true;
  // external_image proxy
  if (/\/external[-_]?image\b/i.test(url)) return true;
  return false;
}

async function main() {
  const { data, error } = await sa
    .from("stiri_cache")
    .select("id, title, media")
    .order("published_at", { ascending: false });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    media: MediaItem[] | null;
  }>;

  let touched = 0;
  let removed = 0;

  for (const row of rows) {
    if (!row.media || row.media.length === 0) continue;
    const kept = row.media.filter((m) => !looksBroken(m.url));
    if (kept.length === row.media.length) continue;
    removed += row.media.length - kept.length;
    await sa
      .from("stiri_cache")
      .update({ media: kept })
      .eq("id", row.id);
    touched++;
    console.log(`[${row.title.slice(0, 60)}] ${row.media.length} → ${kept.length}`);
  }

  console.log(`\nTouched: ${touched} stiri, Removed: ${removed} items`);
}
main();
