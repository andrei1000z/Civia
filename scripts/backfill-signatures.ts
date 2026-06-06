import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { canScrapeUpdates, extractSignatureCount } from "../src/lib/petitii/updates-scraper";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await sb
    .from("petitii")
    .select("id,slug,external_url,status")
    .not("external_url", "is", null)
    .in("status", ["active", "closed"]);
  if (error) {
    console.log("list err:", JSON.stringify(error).slice(0, 150));
    return;
  }
  console.log(`${(data || []).length} petiții cu external_url\n`);
  let updated = 0,
    skipped = 0,
    nullCount = 0;
  for (const p of data || []) {
    if (!canScrapeUpdates(p.external_url)) {
      console.log(`  skip (non-Declic): ${p.slug}`);
      skipped++;
      continue;
    }
    try {
      const res = await fetch(p.external_url!, {
        headers: { "User-Agent": UA, "Accept-Language": "ro-RO,ro;q=0.9" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.log(`  ${p.slug}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const count = extractSignatureCount(html);
      if (count === null) {
        console.log(`  ${p.slug}: count NULL (format necunoscut)`);
        nullCount++;
        continue;
      }
      const { error: upErr } = await sb
        .from("petitii")
        .update({ external_signature_count: count, last_external_sync_at: new Date().toISOString() })
        .eq("id", p.id);
      if (upErr) {
        console.log(`  ${p.slug}: update err ${JSON.stringify(upErr).slice(0, 100)}`);
        continue;
      }
      console.log(`  ${p.slug}: ${count.toLocaleString("ro-RO")} ✓`);
      updated++;
    } catch (e) {
      console.log(`  ${p.slug}: err ${e instanceof Error ? e.message : "?"}`);
    }
  }
  console.log(`\n=== ${updated} actualizate · ${nullCount} fără count · ${skipped} non-Declic ===`);
}
main();
