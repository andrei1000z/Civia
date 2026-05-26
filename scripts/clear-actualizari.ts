/**
 * 2026-05-26 — Curăță complet tabelul `actualizari`.
 *
 * User a cerut explicit: „scoate toate updateurile plm de pe actualizari ca
 * gata am lansat oficial site u si de acum pun updateuri". Lansare oficială
 * = wipe istoric + start fresh.
 *
 * Rulare: `npx tsx scripts/clear-actualizari.ts [--apply]`
 * Fără --apply face dry-run (afișează count).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${apply ? "APPLY (DELETE ALL)" : "DRY-RUN"}\n`);

  // Count first
  const head = await fetch(
    `${url}/rest/v1/actualizari?select=id`,
    {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
      },
    },
  );
  const total = head.headers.get("content-range")?.split("/")?.[1] ?? "?";
  console.log(`Total rows: ${total}`);

  if (!apply) {
    console.log("Dry run. Pasează --apply să șterg toate rândurile.");
    return;
  }

  // Delete cu filter „dummy" — PostgREST cere predicat WHERE pe DELETE.
  // Folosim `id=not.is.null` care match-uiește orice rând care există.
  const del = await fetch(
    `${url}/rest/v1/actualizari?id=not.is.null`,
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
    console.error(`Delete failed: ${del.status} ${await del.text()}`);
    process.exit(1);
  }

  console.log(`✓ Tabel actualizari curățat complet.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
