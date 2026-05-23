import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const id = process.argv[2] ?? "22da8586-6409-4bb2-93f5-b626db2372ba";
  console.log(`Investigating stire id=${id}\n`);

  const { data, error } = await sa
    .from("stiri_cache")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.log("ERR:", error.message);
    return;
  }
  if (!data) {
    console.log("No such stire");
    return;
  }

  // Hide huge fields for readable output
  const slim = { ...data } as Record<string, unknown>;
  delete slim.content;
  delete slim.ai_summary;
  delete slim.ai_raw;
  delete slim.embedding;

  console.log("Row (slim):");
  console.log(JSON.stringify(slim, null, 2));
  console.log("");
  console.log("image_url:", data.image_url);
  console.log("url:", data.url);

  // Try fetching the image to see if it actually resolves
  if (data.image_url) {
    try {
      const res = await fetch(data.image_url, {
        method: "HEAD",
        redirect: "follow",
      });
      console.log(
        `\nImage HEAD: status=${res.status} content-type=${res.headers.get("content-type")} bytes=${res.headers.get("content-length") ?? "?"}`,
      );
    } catch (e) {
      console.log("\nImage HEAD failed:", e instanceof Error ? e.message : String(e));
    }
  } else {
    console.log("\n⚠️ image_url is NULL — never extracted/set");
  }

  // Check stats: how many stiri have null image_url?
  const { count: total } = await sa
    .from("stiri_cache")
    .select("*", { count: "exact", head: true });
  const { count: nullImg } = await sa
    .from("stiri_cache")
    .select("*", { count: "exact", head: true })
    .is("image_url", null);
  const { count: emptyImg } = await sa
    .from("stiri_cache")
    .select("*", { count: "exact", head: true })
    .eq("image_url", "");
  console.log("\n=== GLOBAL STATS ===");
  console.log(`Total stiri:           ${total}`);
  console.log(`With image_url NULL:   ${nullImg}`);
  console.log(`With image_url empty:  ${emptyImg}`);
  console.log(`% missing image:       ${(((nullImg ?? 0) + (emptyImg ?? 0)) / (total ?? 1) * 100).toFixed(1)}%`);

  // Per-source breakdown
  const { data: bySource } = await sa
    .from("stiri_cache")
    .select("source, image_url");
  if (bySource) {
    const map: Record<string, { total: number; missing: number }> = {};
    for (const r of bySource) {
      const src = (r.source as string) ?? "?";
      if (!map[src]) map[src] = { total: 0, missing: 0 };
      map[src].total += 1;
      if (!r.image_url) map[src].missing += 1;
    }
    console.log("\n=== PER SOURCE (sorted by missing) ===");
    const rows = Object.entries(map)
      .map(([s, { total, missing }]) => ({ s, total, missing, pct: (missing / total) * 100 }))
      .sort((a, b) => b.missing - a.missing);
    for (const r of rows) {
      console.log(`  ${r.s.padEnd(20)} ${r.missing.toString().padStart(3)}/${r.total.toString().padStart(3)} (${r.pct.toFixed(0)}% missing)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
