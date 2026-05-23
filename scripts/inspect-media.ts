import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const id = process.argv[2] ?? "5c083580-0715-498e-a0c5-4354a746ca64";
  const { data } = await sa
    .from("stiri_cache")
    .select("title, media")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    console.log("no data");
    return;
  }
  console.log(`Title: ${data.title}`);
  console.log(`Media items: ${(data.media as unknown[])?.length ?? 0}\n`);
  for (const m of (data.media as Array<{ type: string; url: string; caption?: string }>) ?? []) {
    console.log(`  [${m.type}] ${m.url}`);
    if (m.caption) console.log(`    caption: ${m.caption}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
