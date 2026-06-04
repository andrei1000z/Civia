/**
 * Backfill: reformulează descrierea + regenerează textul formal pentru
 * sesizările cu text BRUT (fără diacritice) — rândurile create când Groq AI a
 * picat (ex. 00061). REUTILIZEAZĂ exact pipeline-ul din create route / improve
 * (zero duplicare): reformulateDescriere → acțiuni contextuale → generateFormalText
 * (intro fără redundanță) → objectify → anti-minimizare → reformat. Plus titlu AI.
 *
 * SAFE: dry-run by default. `--apply` scrie în DB. `--code=NNNNN` doar un rând.
 *
 *   npx tsx scripts/backfill-reformulate.ts                  # dry-run, toate brute
 *   npx tsx scripts/backfill-reformulate.ts --code=00061     # dry-run un rând
 *   npx tsx scripts/backfill-reformulate.ts --apply          # scrie toate
 *
 * Necesită în .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * GROQ_API_KEY.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  reformulateDescriere,
  generateContextualActions,
  reorderActions,
  generateTitlu,
} from "@/lib/sesizari/reformulate-descriere";
import { generateFormalText, getPrefabActions } from "@/lib/sesizari/formal-template";
import { objectifyFormalText } from "@/lib/sesizari/objectify";
import { reformatFormalText } from "@/lib/sesizari/format-paragraphs";
import { removeMinimization } from "@/lib/sesizari/anti-minimization";
import { isPlaceholderTitlu } from "@/lib/sesizari/titlu";
import { detectsPoliceContext } from "@/lib/sesizari/authorities";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("❌ Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY în .env.local");
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.error("❌ Lipsește GROQ_API_KEY — reformularea AI nu poate rula.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const codeArg = process.argv.find((a) => a.startsWith("--code="))?.split("=")[1];
const admin = createClient(URL_, KEY);

const hasDiacritics = (s: string | null | undefined) => /[ăâîșțĂÂÎȘȚ]/.test(s ?? "");

type Row = {
  id: string;
  code: string;
  titlu: string;
  descriere: string | null;
  formal_text: string | null;
  tip: string;
  locatie: string;
  author_name: string | null;
  author_address: string | null;
  imagini: string[] | null;
};

async function regenerate(row: Row): Promise<{ descriere: string; formal_text: string; titlu: string }> {
  const rawDescriere = (row.descriere ?? "").trim();
  // 1. Reformulează descrierea (diacritice + registru oficial).
  const descriere = await reformulateDescriere(rawDescriere);

  // 2. Acțiuni — contextuale pentru „altele"/poliție, altfel prefab reordonat
  //    (identic cu /api/ai/improve).
  const prefab = getPrefabActions(row.tip);
  const police = detectsPoliceContext(rawDescriere, row.locatie);
  const needsContextual = row.tip === "altele" || police.needsTraffic || police.needsLocal;
  const customActions = needsContextual
    ? await generateContextualActions({ descriere, tip: row.tip, locatie: row.locatie, prefabFallback: prefab })
    : await reorderActions({ tip: row.tip, descriere, prefabActions: prefab });

  // 3. Text formal — template cu intro fără redundanță + reformulat.
  const raw = generateFormalText({
    tip: row.tip,
    locatie: row.locatie,
    descriere,
    nume: row.author_name,
    adresa: row.author_address,
    hasPhotos: (row.imagini ?? []).length > 0,
    customActions,
  });
  const formal_text = reformatFormalText(
    removeMinimization(
      objectifyFormalText(raw, { locatie: row.locatie, adresaCetatean: null }).text,
    ).text,
  );

  // 4. Titlu — doar dacă e placeholder.
  const titlu = isPlaceholderTitlu(row.titlu)
    ? await generateTitlu({ descriere, locatie: row.locatie })
    : row.titlu;

  return { descriere, formal_text, titlu };
}

async function main() {
  let query = admin
    .from("sesizari")
    .select("id, code, titlu, descriere, formal_text, tip, locatie, author_name, author_address, imagini")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (codeArg) query = admin
    .from("sesizari")
    .select("id, code, titlu, descriere, formal_text, tip, locatie, author_name, author_address, imagini")
    .eq("code", codeArg);

  const { data, error } = await query;
  if (error) { console.error("Query failed:", error.message); process.exit(1); }

  // Țintă: rânduri cu descriere BRUTĂ (fără diacritice). Astea au căzut pe
  // fallback la creare (Groq down). Filtrăm și după lungime minimă.
  const rows = (data ?? []) as Row[];
  const targets = codeArg
    ? rows
    : rows.filter((r) => (r.descriere ?? "").trim().length >= 15 && !hasDiacritics(r.descriere));

  console.log(`Scanate: ${rows.length} · de regenerat (text brut): ${targets.length}`);
  console.log(APPLY ? "MOD: APPLY (scriu în DB)\n" : "MOD: DRY-RUN (--apply ca să scrii)\n");

  let done = 0;
  for (const row of targets) {
    try {
      const next = await regenerate(row);
      console.log(`\n━━━ ${row.code} ━━━`);
      console.log(`titlu : ${row.titlu === next.titlu ? "(neschimbat)" : `„${row.titlu}" → „${next.titlu}"`}`);
      console.log(`descr.: ${(row.descriere ?? "").slice(0, 90)}…`);
      console.log(`     → ${next.descriere.slice(0, 90)}…`);
      console.log(`formal: ${next.formal_text.split("\n\n")[1]?.slice(0, 110) ?? ""}…`);
      if (APPLY) {
        const { error: upErr } = await admin
          .from("sesizari")
          .update({ descriere: next.descriere, formal_text: next.formal_text, titlu: next.titlu })
          .eq("id", row.id);
        if (upErr) console.error(`  ⚠ update eșuat: ${upErr.message}`);
        else done++;
      }
    } catch (e) {
      console.error(`  ⚠ ${row.code} eșuat:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`\nGata. ${APPLY ? `Actualizate: ${done}/${targets.length}` : "(dry-run — 0 scrise)"}`);
}

main();
