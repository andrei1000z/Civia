import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { scrubFormalTextForPublic } from "../src/lib/sesizari/scrub-public";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data } = await sa
    .from("sesizari")
    .select("code, author_name, author_display_name, formal_text")
    .eq("code", "00045")
    .maybeSingle();
  if (!data) return;
  console.log("=== STORED ===");
  console.log("author_name:        ", JSON.stringify(data.author_name));
  console.log("author_display_name:", JSON.stringify(data.author_display_name));
  console.log("formal_text[0..200]:", data.formal_text?.slice(0, 200));

  if (data.formal_text) {
    console.log("\n=== AFTER SCRUB (hideName=true) ===");
    const scrubbed = scrubFormalTextForPublic(data.formal_text, {
      authorName: data.author_name,
      hideName: true,
    });
    console.log(scrubbed.slice(0, 500));
  }
}
main();
