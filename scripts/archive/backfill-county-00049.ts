/**
 * One-shot backfill: setează county=CJ pe sesizarea 00049 (Cluj-Napoca).
 *
 * Bug context: form-ul nu a derivat county la creare → DB row are county=null.
 * Cosign-send + send-via-civia rutau către autoritățile București (default).
 * Fix permanent: detectCountyFromLocatie aplicat în create + cosign/send.
 * Pentru rândul existent, backfill direct.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env");
    process.exit(1);
  }

  const TARGET = "00049";
  const NEW_COUNTY = "CJ";

  // Verify current state
  const before = await fetch(
    `${url}/rest/v1/sesizari?code=eq.${TARGET}&select=id,code,locatie,county`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const beforeRows = await before.json();
  console.log("BEFORE:", JSON.stringify(beforeRows, null, 2));

  if (!beforeRows[0]) {
    console.error(`Sesizare ${TARGET} not found.`);
    process.exit(1);
  }

  // Apply update
  const upd = await fetch(`${url}/rest/v1/sesizari?code=eq.${TARGET}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ county: NEW_COUNTY }),
  });
  if (!upd.ok) {
    console.error(`Update failed: ${upd.status} ${await upd.text()}`);
    process.exit(1);
  }

  // Confirm
  const after = await fetch(
    `${url}/rest/v1/sesizari?code=eq.${TARGET}&select=id,code,locatie,county`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const afterRows = await after.json();
  console.log("AFTER:", JSON.stringify(afterRows, null, 2));
  console.log(`\n✓ Sesizare ${TARGET} county set to ${NEW_COUNTY}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
