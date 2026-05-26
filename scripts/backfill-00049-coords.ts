/**
 * 2026-05-26 — Fix coordonate sesizare 00049.
 *
 * Bug: lat/lng erau (44.4385479, 26.0373717) — undeva în București.
 * Sesizarea e în Cluj-Napoca, Strada Fabricii intersecție cu Strada
 * Ciocârliei (Mărăști). Coords corecte din Nominatim:
 *
 *   - Strada Fabricii (Mărăști): 46.7787, 23.6147
 *   - Strada Ciocârliei (capăt est):  46.7800, 23.6141
 *
 * Intersecția estimată: 46.7798, 23.6143.
 *
 * Rulare: `npx tsx scripts/backfill-00049-coords.ts [--apply]`.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}

const TARGET_CODE = "00049";
const NEW_LAT = 46.7798;
const NEW_LNG = 23.6143;

const apply = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const before = await fetch(
    `${url}/rest/v1/sesizari?code=eq.${TARGET_CODE}&select=id,code,locatie,lat,lng,county`,
    { headers: { apikey: key!, Authorization: `Bearer ${key}` } },
  );
  const rows = (await before.json()) as Array<{
    id: string;
    code: string;
    locatie: string;
    lat: number | null;
    lng: number | null;
    county: string | null;
  }>;
  if (!rows[0]) {
    console.error("Not found");
    process.exit(1);
  }
  console.log("BEFORE:", rows[0]);
  console.log(`AFTER:  lat=${NEW_LAT}, lng=${NEW_LNG} (Mărăști, Cluj-Napoca)`);

  if (!apply) return;

  const upd = await fetch(`${url}/rest/v1/sesizari?code=eq.${TARGET_CODE}`, {
    method: "PATCH",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ lat: NEW_LAT, lng: NEW_LNG, locality: "Cluj-Napoca" }),
  });
  if (!upd.ok) {
    console.error(`update failed: ${upd.status} ${await upd.text()}`);
    process.exit(1);
  }
  console.log(`\n✓ Coords + locality actualizate pentru ${TARGET_CODE}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
