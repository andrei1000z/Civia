/**
 * Backfill formal_text pentru sesizările cu artefacte vechi:
 *   - „Mă numesc  și doresc..." (placeholder gol)
 *   - „Mă numesc [NUMELE]..." (placeholder ne-substituit)
 *   - „Subsemnatul X, domiciliat în [ADRESA]..." (legacy + placeholder)
 *
 * Bug raportat user 5/20/2026 pe sesizarea 00042: prewarm AI rula
 * înainte de profile load → AI primea nume gol → formal_text salvat
 * broken. Codul curent previne asta pentru sesizări noi; acest script
 * curăță cele EXISTENTE în DB.
 *
 * Strategie:
 *   1. Pull sesizări cu user_id NOT NULL.
 *   2. Pentru fiecare, fetch profile (full_name + address).
 *   3. Aplică repairSesizareLeaks pe formal_text.
 *   4. Dacă a rămas „Mă numesc " orfan + utilizatorul are full_name +
 *      address: injectează linia „Mă numesc {name}, locuiesc în {addr}"
 *      la opener (după „Bună ziua,").
 *   5. UPDATE formal_text doar dacă s-a schimbat.
 *
 * Run:
 *   npx tsx scripts/backfill-formal-text.ts                  # dry-run
 *   npx tsx scripts/backfill-formal-text.ts --apply          # write to DB
 *   npx tsx scripts/backfill-formal-text.ts --apply --code=00042  # single
 */

import { config as dotenvConfig } from "dotenv";
// Load .env.local first (override .env if present)
dotenvConfig({ path: ".env.local" });
dotenvConfig();
import { createClient } from "@supabase/supabase-js";
import { repairSesizareLeaks } from "../src/lib/sesizari/format-helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const codeArg = args.find((a) => a.startsWith("--code="))?.split("=")[1];

const sa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SesizareRow {
  id: string;
  code: string;
  user_id: string | null;
  author_name: string | null;
  formal_text: string | null;
}

interface ProfileRow {
  full_name: string | null;
  address: string | null;
}

function isBroken(text: string): boolean {
  return (
    /Mă numesc\s+(?:și|şi|si)\s+\w/.test(text) ||
    /Mă numesc\s+(?:doresc|solicit|vă\s+aduc)/.test(text) ||
    /\[NUMELE\]|\[ADRESA\]/.test(text) ||
    /Mă numesc\s+\[/.test(text)
  );
}

function injectIdentity(
  text: string,
  name: string | null,
  address: string | null,
): string {
  if (!name || !address) return text;
  // Doar dacă, după repair, textul NU conține deja o linie de identitate.
  if (/Mă numesc\s+\S+/.test(text) || /Subsemnat/i.test(text)) return text;
  return text.replace(
    /(Bun[ăa] ziua,?)/i,
    `$1\n\nMă numesc ${name}, locuiesc în ${address} și doresc să vă aduc la cunoștință o problemă care necesită intervenția dumneavoastră.`,
  );
}

async function main() {
  console.log(`[backfill] ${APPLY ? "APPLY MODE" : "DRY RUN"} — code filter: ${codeArg ?? "all"}`);

  // Include rândurile fără user_id când filtrăm pe un cod specific (guest
  // sesizari pot fi reparate text-only chiar dacă n-au profile asociat).
  let q = sa
    .from("sesizari")
    .select("id, code, user_id, author_name, formal_text")
    .not("formal_text", "is", null);

  if (codeArg) {
    q = q.eq("code", codeArg);
  } else {
    q = q.not("user_id", "is", null);
  }

  const { data: rows, error } = await q.limit(5000);
  if (error) {
    console.error("Failed to fetch sesizari:", error);
    process.exit(1);
  }

  const all = (rows ?? []) as SesizareRow[];
  console.log(`[backfill] Pulled ${all.length} sesizari with user_id`);

  let scanned = 0;
  let broken = 0;
  let fixed = 0;
  let updatedDb = 0;

  for (const row of all) {
    scanned += 1;
    if (!row.formal_text) continue;
    const wasBroken = isBroken(row.formal_text);
    if (!wasBroken) continue;
    broken += 1;

    // Fetch profile to get name + address for injection.
    const { data: prof } = await sa
      .from("profiles")
      .select("full_name, address")
      .eq("id", row.user_id!)
      .maybeSingle();
    const profile = (prof ?? {}) as ProfileRow;

    // Pipeline: repair → optional inject if identity still missing.
    let next = repairSesizareLeaks(row.formal_text);
    next = injectIdentity(next, profile.full_name ?? row.author_name, profile.address);

    if (next === row.formal_text) continue;
    fixed += 1;
    console.log(`[backfill] ${row.code} — fixed (was ${row.formal_text.length}c, now ${next.length}c)`);

    if (APPLY) {
      const { error: upErr } = await sa
        .from("sesizari")
        .update({ formal_text: next })
        .eq("id", row.id);
      if (upErr) {
        console.error(`[backfill] ${row.code} UPDATE failed:`, upErr.message);
        continue;
      }
      updatedDb += 1;
    }
  }

  console.log(
    `\n[backfill] Done. scanned=${scanned}, broken=${broken}, fixed=${fixed}, ` +
    `db_updates=${updatedDb}${APPLY ? "" : " (DRY RUN — re-run with --apply)"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
