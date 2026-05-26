/**
 * One-shot backfill pentru sesizarea 00024 — regenerează `formal_text`
 * cu noua logică din `generateFormalText` (care folosește descrierea
 * cetățeanului în loc de boilerplate-ul hardcoded per-tip).
 *
 * Bug context: sesizarea 00024 are descrierea „Există un gard despărțitor
 * pe linia 5 de tramvai..." dar formal_text scris la creare conține
 * boilerplate despre stâlpișori/trotuar/pietoni — complet pe lângă subiect
 * pentru că vechiul `generateFormalText` ignora descrierea.
 *
 * Rulare: `npx tsx scripts/backfill-formal-text-00024.ts [--apply]`
 * Fără --apply face dry-run + print before/after.
 */

import { config } from "dotenv";
import { generateFormalText } from "../src/lib/sesizari/formal-template";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TARGET_CODE = "00024";
const apply = process.argv.includes("--apply");
/**
 * Tip-ul corect pentru sesizare 00024 — descrierea e despre infrastructura
 * tramvai („gard despărțitor pe linia 5 de tramvai"), nu despre stâlpișori
 * anti-parcare pe trotuar. Schimbăm tip-ul → „transport" ca acțiunile
 * generate să fie topical relevante.
 */
const CORRECT_TIP = "transport";

interface SesizareRow {
  id: string;
  code: string;
  titlu: string;
  descriere: string;
  locatie: string;
  tip: string;
  author_name: string | null;
  imagini: string[] | null;
  formal_text: string | null;
  created_at: string;
}

async function fetchRow(): Promise<SesizareRow | null> {
  const r = await fetch(
    `${url}/rest/v1/sesizari?code=eq.${TARGET_CODE}&select=id,code,titlu,descriere,locatie,tip,author_name,imagini,formal_text,created_at&limit=1`,
    {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!r.ok) {
    console.error(`fetch failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  const rows = (await r.json()) as SesizareRow[];
  return rows[0] ?? null;
}

async function updateRow(id: string, formalText: string, tip: string): Promise<void> {
  const r = await fetch(`${url}/rest/v1/sesizari?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ formal_text: formalText, tip }),
  });
  if (!r.ok) {
    console.error(`update failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY (will UPDATE)" : "DRY-RUN"}`);
  console.log(`Target sesizare: ${TARGET_CODE}\n`);

  const row = await fetchRow();
  if (!row) {
    console.error(`Sesizarea ${TARGET_CODE} nu a fost găsită.`);
    process.exit(1);
  }

  console.log("─── BEFORE ─────────────────────────────────────────────");
  console.log(`Titlu:     ${row.titlu}`);
  console.log(`Tip:       ${row.tip}`);
  console.log(`Locație:   ${row.locatie}`);
  console.log(`Descriere: ${row.descriere}`);
  console.log("\nFormal text vechi:");
  console.log(row.formal_text ?? "(null)");

  const newFormalText = generateFormalText({
    tip: CORRECT_TIP,
    locatie: row.locatie,
    descriere: row.descriere,
    nume: row.author_name,
    // Adresa nu o avem din această tabelă; sesizările vechi nu au stocată
    // adresa cetățeanului în clar (privacy by design). Lăsăm null →
    // template-ul omit-ăm fraza „locuiesc în...".
    adresa: null,
    hasPhotos: (row.imagini ?? []).length > 0,
    date: new Date(row.created_at),
  });

  console.log("\n─── AFTER ─────────────────────────────────────────────");
  console.log(`Tip: ${row.tip} → ${CORRECT_TIP}`);
  console.log(newFormalText);

  if (!apply) {
    console.log("\nDry run. Pasează --apply să scrii în DB.");
    return;
  }

  await updateRow(row.id, newFormalText, CORRECT_TIP);
  console.log(`\n✓ formal_text + tip actualizate pentru sesizarea ${TARGET_CODE}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
