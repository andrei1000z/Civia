// Curăță sesizările existente:
//   1. Aplică repairSesizareLeaks pe formal_text (include „Sector X. Y" fix)
//   2. Aplică „Sector X. Y" → „Sector X" pe locatie direct
//
// Usage:
//   npx tsx scripts/repair-sesizari-leaks.ts          # raport doar
//   npx tsx scripts/repair-sesizari-leaks.ts --apply  # aplică update

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { repairSesizareLeaks } from "../src/lib/sesizari/format-helpers";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const SECTOR_DUP_RE = /\b(Sector\s+\d+)\.\s+\d{1,3}\b/gi;

function repairLocatie(loc: string | null): string | null {
  if (!loc) return loc;
  return loc.replace(SECTOR_DUP_RE, "$1");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("sesizari")
    .select("id, code, formal_text, locatie");

  if (error) {
    console.error("DB error:", error.message);
    process.exit(1);
  }

  type Patch = {
    id: string;
    code: string;
    formal_text?: string | null;
    locatie?: string | null;
    diffs: string[];
  };

  const patches: Patch[] = [];

  for (const row of data ?? []) {
    const r = row as { id: string; code: string; formal_text: string | null; locatie: string | null };
    const patch: Patch = { id: r.id, code: r.code, diffs: [] };

    if (r.formal_text) {
      const after = repairSesizareLeaks(r.formal_text);
      if (after !== r.formal_text) {
        patch.formal_text = after;
        patch.diffs.push("formal_text");
      }
    }

    if (r.locatie) {
      const after = repairLocatie(r.locatie);
      if (after !== r.locatie) {
        patch.locatie = after;
        patch.diffs.push(`locatie: "${r.locatie}" → "${after}"`);
      }
    }

    if (patch.diffs.length > 0) patches.push(patch);
  }

  console.log(`Scanate ${data?.length ?? 0} sesizări. ${patches.length} cu modificări.`);
  const showDiff = process.argv.includes("--diff");
  for (const p of patches) {
    console.log(`  - ${p.code}: ${p.diffs.join(", ")}`);
    if (showDiff && p.formal_text !== undefined) {
      const before = (data ?? []).find((r) => (r as { id: string }).id === p.id) as { formal_text: string } | undefined;
      const beforeLines = (before?.formal_text ?? "").split("\n");
      const afterLines = p.formal_text.split("\n");
      const max = Math.max(beforeLines.length, afterLines.length);
      for (let i = 0; i < max; i++) {
        if (beforeLines[i] !== afterLines[i]) {
          console.log(`      L${i + 1}-: ${JSON.stringify(beforeLines[i] ?? "")}`);
          console.log(`      L${i + 1}+: ${JSON.stringify(afterLines[i] ?? "")}`);
        }
      }
    }
  }

  if (!apply) {
    console.log("\nRulează cu --apply pentru a aplica în DB.");
    return;
  }
  if (patches.length === 0) {
    console.log("Nimic de făcut.");
    return;
  }

  let ok = 0;
  for (const p of patches) {
    const update: Record<string, string | null> = {};
    if (p.formal_text !== undefined) update.formal_text = p.formal_text;
    if (p.locatie !== undefined) update.locatie = p.locatie;

    const { error: updateError } = await supabase
      .from("sesizari")
      .update(update)
      .eq("id", p.id);
    if (updateError) {
      console.error(`  X ${p.code}: ${updateError.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nUpdated: ${ok}/${patches.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
