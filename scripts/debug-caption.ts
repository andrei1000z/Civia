import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data } = await sa
    .from("stiri_cache")
    .select("id, title, media")
    .order("published_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    media: Array<{ type: string; url: string; caption?: string }> | null;
  }>;

  let count = 0;
  for (const row of rows) {
    if (!row.media) continue;
    for (const m of row.media) {
      if (m.caption && m.caption.trim() === row.title.trim()) {
        count++;
        console.log(`[${row.id.slice(0, 8)}] title="${row.title.slice(0, 60)}"`);
        console.log(`  caption="${m.caption.slice(0, 60)}"`);
        console.log(`  type=${m.type}, url=${m.url.slice(0, 80)}`);
        console.log();
      }
    }
  }
  console.log(`Total: ${count}`);
}
main();
