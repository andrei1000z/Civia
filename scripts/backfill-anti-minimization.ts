/**
 * Backfill: scoate fraze de minimizare din formal_text-ul sesizarilor
 * existente + reaplica paragrafarea (reformatFormalText) ca textele
 * vechi care au pierdut paragrafele intr-un run anterior (bug colaps
 * \s{2,} → " ") sa fie reformatate corect.
 *
 * Bug raportat 5/19/2026 pe 00041:
 *   1) AI emisese fraza „pietonilor li se asigura inca suficient
 *      spatiu" care SUBMINEAZA sesizarea.
 *   2) removeMinimization avea bug — regex-ul `\s{2,} → " "` colapsa
 *      newline-urile, distrugand toate paragrafele.
 *
 * Acum aplicam si reformatFormalText la backfill ca sa repare textele
 * deja stricate. Idempotent — re-rularea pe text deja corect nu il
 * schimba (signature exact match preserved).
 *
 * Usage:
 *   npx tsx scripts/backfill-anti-minimization.ts dry-run
 *   npx tsx scripts/backfill-anti-minimization.ts apply
 */

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { removeMinimization } from "../src/lib/sesizari/anti-minimization";
import { reformatFormalText } from "../src/lib/sesizari/format-paragraphs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mode = process.argv[2] === "apply" ? "apply" : "dry-run";

async function main() {
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  console.log(`▶ Backfill anti-minimization — mode: ${mode}`);

  const { data: rows, error } = await admin
    .from("sesizari")
    .select("id, code, formal_text")
    .not("formal_text", "is", null);

  if (error) {
    console.error("fetch failed:", error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("nicio sesizare");
    return;
  }

  let toUpdate = 0;
  let updated = 0;
  for (const r of rows) {
    if (!r.formal_text) continue;
    // 1) Anti-minimization
    const antiMin = removeMinimization(r.formal_text);
    // 2) Reformat paragrafe (idempotent — daca textul are deja paragrafele
    //    corecte, output e identic cu input dupa stripping trailing whitespace).
    const reformatted = reformatFormalText(antiMin.text);
    // Schimbam doar daca textul final difera de original.
    const changed = reformatted !== r.formal_text;
    if (!changed) continue;
    toUpdate += 1;

    if (mode === "apply") {
      const { error: upErr } = await admin
        .from("sesizari")
        .update({ formal_text: reformatted })
        .eq("id", r.id);
      if (upErr) console.error(`✗ ${r.code}: ${upErr.message}`);
      else updated += 1;
    } else {
      const reformatOnly = !antiMin.changed && reformatted !== r.formal_text;
      console.log(
        `[${r.code}] minimizations=${antiMin.replacements}${reformatOnly ? " (reformat-only)" : ""}`,
      );
      for (const m of antiMin.matched) {
        console.log(`  → ${m.slice(0, 80)}${m.length > 80 ? "..." : ""}`);
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`Scanate: ${rows.length}`);
  console.log(`Necesita patch: ${toUpdate}`);
  if (mode === "apply") {
    console.log(`Updated efectiv: ${updated}`);
  } else {
    console.log(`(dry-run — pentru apply: npx tsx scripts/backfill-anti-minimization.ts apply)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
