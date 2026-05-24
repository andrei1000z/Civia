// Verifică populația din src/data/counties.ts vs reference INS Recensământ 2021.
// Output: tabel CSV cu diff-uri >100 oameni. Nu modifică nimic.
//
// Usage: npm run verify:populations
//
// Sursa reference: INS Recensământ 2021 — populație rezidentă, rezultate finale
// publicate 2023. Snapshot la moment-ul scrierii (2026-04-29).
// Update periodic dacă INS publică recensământ nou.

import { ALL_COUNTIES } from "../src/data/counties";

// Reference INS 2021 — populație rezidentă (final results)
// Source: insse.ro/recensamantul-populatiei-si-locuintelor-2021/
const INS_2021: Record<string, number> = {
  AB: 323_778,
  AR: 409_072,
  AG: 560_191,
  BC: 580_348,
  BH: 551_297,
  BN: 277_861,
  BT: 376_176,
  BR: 281_422,
  BV: 546_408,
  B: 1_716_961,
  BZ: 410_723,
  CL: 270_054,
  CS: 252_791,
  CJ: 691_106,
  CT: 643_354,
  CV: 197_677,
  DB: 468_323,
  DJ: 600_334,
  GL: 498_617,
  GR: 224_246,
  GJ: 306_762,
  HR: 296_943,
  HD: 371_033,
  IL: 244_280,
  IS: 760_774,
  IF: 472_751,
  MM: 430_790,
  MH: 228_384,
  MS: 525_671,
  NT: 438_207,
  OT: 363_687,
  PH: 678_033,
  SJ: 205_914,
  SM: 330_327,
  SB: 397_322,
  SV: 622_938,
  TR: 300_499,
  TM: 646_640,
  TL: 193_355,
  VL: 340_588,
  VS: 371_156,
  VN: 315_798,
};

const TOLERANCE = 100; // diff under 100 = rounding noise, ignore

let totalDiffs = 0;
const rows: Array<{ id: string; name: string; current: number; reference: number; diff: number }> = [];

for (const c of ALL_COUNTIES) {
  const reference = INS_2021[c.id];
  if (reference === undefined) {
    console.warn(`No INS reference for ${c.id} (${c.name})`);
    continue;
  }
  const diff = c.population - reference;
  if (Math.abs(diff) > TOLERANCE) {
    totalDiffs++;
    rows.push({ id: c.id, name: c.name, current: c.population, reference, diff });
  }
}

console.log("judet,nume,current,ins_2021,diff");
for (const r of rows) {
  const sign = r.diff > 0 ? "+" : "";
  console.log(`${r.id},${r.name},${r.current},${r.reference},${sign}${r.diff}`);
}

console.log("");
if (totalDiffs === 0) {
  console.log(`OK: toate ${ALL_COUNTIES.length} județe match INS 2021 (tolerance ${TOLERANCE}).`);
  process.exit(0);
} else {
  console.log(`WARN: ${totalDiffs} județe au diff > ${TOLERANCE} oameni vs INS 2021.`);
  console.log("Verifică pe insse.ro dacă reference snapshot e actualizat sau current e drift.");
  process.exit(1);
}
