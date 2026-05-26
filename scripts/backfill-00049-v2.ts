/**
 * 2026-05-26 — Backfill complet sesizarea 00049.
 *
 * User a observat că pe pagina publică /sesizari/00049 textul formal NU
 * arată identitatea „Mă numesc X, locuiesc în Y" — doar începe direct cu
 * „Doresc să vă aduc la cunoștință". Motivul: la creare,
 * `author_address` a fost null (Alexa Tudor a trimis anonim, fără
 * adresă), deci template-ul a omis fraza de identitate. Acum că standardul
 * Civia.ro e că identitatea TREBUIE să apară (cu redactare publică),
 * backfill-uim:
 *
 *   1. locatie → "Strada Fabricii 1-5, Cluj-Napoca, cu predominanță în
 *      intersecția cu Strada Ciocârliei." (user a cerut explicit text nou)
 *   2. descriere → versiune curată cu majuscule + punctuație corectă
 *   3. author_address → "Cluj-Napoca" (fallback civic — pe pagina publică
 *      apare ca [adresa] după scrub; în email-uri oficiale apare numele
 *      orașului, care e o adresă acceptabilă pentru identificare cu
 *      author_name + cod sesizare)
 *   4. formal_text → re-generat cu generateFormalText, având nume + adresa
 *      → conține fraza „Mă numesc Alexa Tudor, locuiesc în Cluj-Napoca și
 *      doresc să vă aduc la cunoștință..."
 *   5. Sterge cele 2 cosigner rows (suspecte fake — user a cerut explicit)
 *
 * Rulare: `npx tsx scripts/backfill-00049-v2.ts [--apply]`
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

const TARGET_CODE = "00049";
const apply = process.argv.includes("--apply");

const NEW_LOCATIE =
  "Strada Fabricii 1-5, Cluj-Napoca, cu predominanță în intersecția cu Strada Ciocârliei";
const NEW_DESCRIERE =
  "Pe Strada Fabricii din Cluj-Napoca există probleme cu mașinile parcate pe trotuar și pe trecerea de pietoni. Multe vehicule rămân abandonate timp îndelungat, îngreunând accesul pietonilor.";
const NEW_AUTHOR_ADDRESS = "Cluj-Napoca";

interface SesizareRow {
  id: string;
  code: string;
  titlu: string;
  descriere: string;
  locatie: string;
  tip: string;
  author_name: string | null;
  author_address: string | null;
  imagini: string[] | null;
  formal_text: string | null;
  created_at: string;
}

async function fetchRow(): Promise<SesizareRow | null> {
  const r = await fetch(
    `${url}/rest/v1/sesizari?code=eq.${TARGET_CODE}&select=id,code,titlu,descriere,locatie,tip,author_name,author_address,imagini,formal_text,created_at&limit=1`,
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

async function updateRow(
  id: string,
  patch: {
    locatie: string;
    descriere: string;
    author_address: string;
    formal_text: string;
  },
): Promise<void> {
  const r = await fetch(`${url}/rest/v1/sesizari?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    console.error(`update failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
}

async function deleteCosigners(sesizareId: string): Promise<number> {
  const r = await fetch(
    `${url}/rest/v1/sesizare_cosigners?sesizare_id=eq.${sesizareId}&select=id`,
    {
      method: "GET",
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  const existing = (await r.json()) as Array<{ id: string }>;
  if (existing.length === 0) return 0;

  const del = await fetch(
    `${url}/rest/v1/sesizare_cosigners?sesizare_id=eq.${sesizareId}`,
    {
      method: "DELETE",
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
    },
  );
  if (!del.ok) {
    console.error(`delete cosigners failed: ${del.status} ${await del.text()}`);
    process.exit(1);
  }
  return existing.length;
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY (will UPDATE + DELETE)" : "DRY-RUN"}`);
  console.log(`Target sesizare: ${TARGET_CODE}\n`);

  const row = await fetchRow();
  if (!row) {
    console.error(`Sesizarea ${TARGET_CODE} nu a fost găsită.`);
    process.exit(1);
  }

  console.log("─── BEFORE ─────────────────────────────────────────────");
  console.log(`Locație:        ${row.locatie}`);
  console.log(`Descriere:      ${row.descriere}`);
  console.log(`Adresa autor:   ${row.author_address ?? "(null)"}`);
  console.log(`\nFormal text vechi:`);
  console.log(row.formal_text ?? "(null)");

  const newFormalText = generateFormalText({
    tip: row.tip,
    locatie: NEW_LOCATIE,
    descriere: NEW_DESCRIERE,
    nume: row.author_name,
    adresa: NEW_AUTHOR_ADDRESS,
    hasPhotos: (row.imagini ?? []).length > 0,
    date: new Date(row.created_at),
  });

  console.log("\n─── AFTER ─────────────────────────────────────────────");
  console.log(`Locație:        ${NEW_LOCATIE}`);
  console.log(`Descriere:      ${NEW_DESCRIERE}`);
  console.log(`Adresa autor:   ${NEW_AUTHOR_ADDRESS}`);
  console.log(`\nFormal text nou:`);
  console.log(newFormalText);

  if (!apply) {
    console.log("\nDry run. Pasează --apply să scrii în DB + șterge cosigner-ii.");
    return;
  }

  await updateRow(row.id, {
    locatie: NEW_LOCATIE,
    descriere: NEW_DESCRIERE,
    author_address: NEW_AUTHOR_ADDRESS,
    formal_text: newFormalText,
  });
  const deleted = await deleteCosigners(row.id);
  console.log(`\n✓ Sesizarea ${TARGET_CODE} actualizată.`);
  console.log(`✓ ${deleted} cosigner-i șterși.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
