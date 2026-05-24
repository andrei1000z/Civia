// Scanează toate sesizările cu formal_text și raportează / curăță
// markdown-ul (** __ ## `) care a fost strecurat de Llama.
//
// Usage:
//   npx tsx scripts/strip-markdown-all-sesizari.ts          # raport doar
//   npx tsx scripts/strip-markdown-all-sesizari.ts --apply  # aplică update

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
  const apply = process.argv.includes("--apply");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("sesizari")
    .select("id, code, formal_text")
    .not("formal_text", "is", null);

  if (error) {
    console.error("DB error:", error.message);
    process.exit(1);
  }

  const dirty: { id: string; code: string; before: string; after: string }[] = [];
  for (const row of data ?? []) {
    const before = row.formal_text as string;
    const after = stripMarkdown(before);
    if (before !== after) dirty.push({ id: row.id, code: row.code, before, after });
  }

  console.log(`Scanate ${data?.length ?? 0} sesizări. ${dirty.length} cu markdown.`);
  for (const d of dirty) {
    const lineCount = d.before.split("\n").filter((l, i) => l !== d.after.split("\n")[i]).length;
    console.log(`  - ${d.code}: ${lineCount} linii cu markdown`);
  }

  if (!apply) {
    console.log("\nRulează cu --apply pentru a curăța în DB.");
    return;
  }
  if (dirty.length === 0) {
    console.log("Nimic de făcut.");
    return;
  }

  let ok = 0;
  for (const d of dirty) {
    const { error: updateError } = await supabase
      .from("sesizari")
      .update({ formal_text: d.after })
      .eq("id", d.id);
    if (updateError) {
      console.error(`  X ${d.code}: ${updateError.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nCurățate: ${ok}/${dirty.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
