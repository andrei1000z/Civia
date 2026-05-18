/**
 * Backfill: sparge numerotarea inline din formal_text pe sesizari existente.
 *
 * AI-ul a emis ocazional „1. Analiza... 2. Ajustarea... 3. Verificarea..."
 * pe acelasi rand → render-ul aparea ca un block monoton ilizibil.
 *
 * Aplicam aceeasi regex ca in normalizeFormatting:
 *   /(\.\s)(\d{1,2}\.\s)(?=[A-ZĂÂÎȘȚ])/g → adauga \n inainte de cifra
 *
 * Usage:
 *   npx tsx scripts/backfill-format-formal-text.ts dry-run
 *   npx tsx scripts/backfill-format-formal-text.ts apply
 */

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const mode = process.argv[2] === "apply" ? "apply" : "dry-run";

const TRANSITIONS = [
  "Pentru a rezolva",
  "Având în vedere",
  "De asemenea",
  "În temeiul",
  "În sprijinul",
  "În acest sens",
  "În scopul",
  "Vă mulțumesc",
  "Cu stimă",
  "Cu respect",
];

function reformat(text: string): string {
  let t = text.replace(/\r\n/g, "\n");
  // Sparge numerotare inline (1. ... 2. ... 3. ...) si dupa colon (după
  // ": 1. ...").
  t = t.replace(/([.:]\s)(\d{1,2}\.\s)(?=[A-ZĂÂÎȘȚ])/g, "$1\n$2");
  // Sparge frazele de tranziție inline.
  for (const phrase of TRANSITIONS) {
    const re = new RegExp(`(\\.\\s)(${phrase})`, "g");
    t = t.replace(re, "$1\n\n$2");
  }
  // Salut: „Bună ziua, Mă numesc..." → linii separate
  t = t.replace(/(Bună ziua,)\s+(Mă numesc)/g, "$1\n\n$2");
  // Semnatura: „Cu stimă, NUME DATA" → fiecare pe linie proprie
  t = t.replace(
    /(Cu (?:stimă|respect),)\s+([^\n]+?)\s+(\d{1,2}\s+\w+\s+\d{4})$/m,
    "$1\n$2\n$3",
  );
  // Collapse triple+ newlines la 2.
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

async function main() {
  const admin = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`▶ Backfill format formal_text — mode: ${mode}`);

  const { data: rows, error } = await admin
    .from("sesizari")
    .select("id, code, formal_text")
    .not("formal_text", "is", null);

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("Nicio sesizare cu formal_text.");
    return;
  }

  console.log(`Scanate ${rows.length} sesizari.`);

  let toUpdate = 0;
  let updated = 0;
  for (const r of rows) {
    if (!r.formal_text) continue;
    const reformatted = reformat(r.formal_text);
    if (reformatted === r.formal_text) continue;
    toUpdate += 1;

    if (mode === "dry-run") {
      // Cauta diferentele: liniile nou-rupte
      const beforeLines = r.formal_text.split("\n").length;
      const afterLines = reformatted.split("\n").length;
      const added = afterLines - beforeLines;
      console.log(`[${r.code}] +${added} linii noi`);
    } else {
      const { error: upErr } = await admin
        .from("sesizari")
        .update({ formal_text: reformatted })
        .eq("id", r.id);
      if (upErr) {
        console.error(`  ✗ ${r.code}: ${upErr.message}`);
      } else {
        updated += 1;
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`Scanate: ${rows.length}`);
  console.log(`Necesita reformat: ${toUpdate}`);
  if (mode === "apply") {
    console.log(`Updated efectiv: ${updated}`);
  } else {
    console.log(`(Dry-run — pentru apply: npx tsx scripts/backfill-format-formal-text.ts apply)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
