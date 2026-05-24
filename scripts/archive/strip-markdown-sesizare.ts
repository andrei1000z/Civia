// One-shot: strip markdown ( **bold**, __italic__, ## titluri, `cod` )
// din formal_text al unei sesizări. Folosit când Llama a strecurat
// markdown în text înainte de fix-ul prompt-ului.
//
// Usage:
//   npx tsx scripts/strip-markdown-sesizare.ts <code>
//   npx tsx scripts/strip-markdown-sesizare.ts 00014
//   npx tsx scripts/strip-markdown-sesizare.ts 00014 --dry

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

function stripMarkdown(text: string): string {
  let t = text;
  t = t.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  t = t.replace(/__([^_\n]+?)__/g, "$1");
  t = t.replace(/(^|\s)\*([^*\n]+?)\*(?=\s|[.,;:!?)]|$)/g, "$1$2");
  t = t.replace(/(^|\s)_([^_\n]+?)_(?=\s|[.,;:!?)]|$)/g, "$1$2");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/`([^`\n]+?)`/g, "$1");
  return t;
}

async function main() {
  const args = process.argv.slice(2);
  const code = args.find((a) => !a.startsWith("--"));
  const dry = args.includes("--dry");
  if (!code) {
    console.error("Usage: npx tsx scripts/strip-markdown-sesizare.ts <code> [--dry]");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("sesizari")
    .select("id, code, formal_text, descriere")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("DB error:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`Nu s-a găsit nicio sesizare cu code=${code}`);
    process.exit(1);
  }

  const original = data.formal_text ?? "";
  if (!original) {
    console.error("Sesizarea nu are formal_text.");
    process.exit(1);
  }

  const cleaned = stripMarkdown(original);
  if (cleaned === original) {
    console.log(`Nimic de curățat — formal_text-ul lui ${code} nu conține markdown.`);
    return;
  }

  console.log(`\n--- ÎNAINTE (${code}) ---\n${original}\n`);
  console.log(`--- DUPĂ ---\n${cleaned}\n`);
  // Show line-by-line which lines actually changed (signal vs noise)
  const beforeLines = original.split("\n");
  const afterLines = cleaned.split("\n");
  const changed: string[] = [];
  for (let i = 0; i < beforeLines.length; i++) {
    if (beforeLines[i] !== afterLines[i]) {
      changed.push(`L${i + 1}:\n  - ${beforeLines[i]}\n  + ${afterLines[i]}`);
    }
  }
  console.log(`--- LINII MODIFICATE (${changed.length}) ---\n${changed.join("\n\n")}\n`);

  if (dry) {
    console.log("Dry-run. Pentru a salva, rulează fără --dry.");
    return;
  }

  const { error: updateError } = await supabase
    .from("sesizari")
    .update({ formal_text: cleaned })
    .eq("id", data.id);

  if (updateError) {
    console.error("Update error:", updateError.message);
    process.exit(1);
  }

  console.log(`OK — sesizarea ${code} a fost actualizată.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
