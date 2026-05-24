/**
 * Backfill: sanitize formal_text pe sesizari existente — sterge claims
 * subjective gen „in dreptul domiciliu meu", „in fata blocului meu", etc.
 *
 * Acestea n-au fost niciodata corecte (texte AI generate inainte de noua
 * regula 11/12 in SYSTEM_PROMPT_FORMAL si inainte de objectifyFormalText
 * post-processing). Co-semnatarii reutilizau template-ul fara sa fie
 * adevarat ca locuiesc acolo.
 *
 * Usage:
 *   npx tsx scripts/backfill-objectify-formal-text.ts dry-run   # afiseaza ce s-ar schimba
 *   npx tsx scripts/backfill-objectify-formal-text.ts apply     # scrie in DB
 *
 * Pe fiecare sesizare ruleaza objectifyFormalText cu locatie din DB +
 * adresaCetatean=null (n-avem adresa server-side). Updates numai randurile
 * unde au fost facute replacements.
 */

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { objectifyFormalText } from "../src/lib/sesizari/objectify";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const mode = process.argv[2] === "apply" ? "apply" : "dry-run";

async function main() {
  const admin = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`▶ Backfill objectify formal_text — mode: ${mode}`);

  const { data: rows, error } = await admin
    .from("sesizari")
    .select("id, code, locatie, formal_text")
    .not("formal_text", "is", null);

  if (error) {
    console.error("Fetch failed:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("Nicio sesizare cu formal_text. Done.");
    return;
  }

  console.log(`Scanate ${rows.length} sesizari cu formal_text.`);

  let toUpdate = 0;
  let updated = 0;
  for (const r of rows) {
    if (!r.formal_text) continue;
    const result = objectifyFormalText(r.formal_text, {
      locatie: r.locatie,
      adresaCetatean: null,
    });
    if (!result.changed) continue;
    toUpdate += 1;

    if (mode === "dry-run") {
      console.log(`\n[${r.code}] ${result.replacements} replacements:`);
      // Afiseaza un snippet diff
      const original = r.formal_text;
      const before = original.slice(0, 200);
      const after = result.text.slice(0, 200);
      console.log(`  BEFORE: ${before.replace(/\s+/g, " ")}`);
      console.log(`  AFTER:  ${after.replace(/\s+/g, " ")}`);
    } else {
      const { error: upErr } = await admin
        .from("sesizari")
        .update({ formal_text: result.text })
        .eq("id", r.id);
      if (upErr) {
        console.error(`  ✗ ${r.code}: ${upErr.message}`);
      } else {
        updated += 1;
        if (updated % 50 === 0) console.log(`  ...${updated} updated`);
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`Scanate: ${rows.length}`);
  console.log(`Necesita sanitize: ${toUpdate}`);
  if (mode === "apply") {
    console.log(`Updated efectiv: ${updated}`);
  } else {
    console.log(`(Dry-run — pentru a aplica: npx tsx scripts/backfill-objectify-formal-text.ts apply)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
