/**
 * Smoke-test the county auto-detect parser against real Nominatim
 * responses. For every county we hit Nominatim with:
 *   1. The county center (always inside the county, easy)
 *   2. Three random offsets within ~30km of center (medium)
 *   3. The center of the county's largest city (best-known location)
 *
 * Compares the returned countyCode to the expected county id and prints
 * a pass/fail line per probe. Total ~200 probes; with Nominatim's 1
 * req/sec policy that's ~3.5 minutes runtime.
 *
 * Usage: npx tsx scripts/audit-county-detect.ts
 *   Add --quick to sample only 1 probe per county (~45 seconds).
 */

import { ALL_COUNTIES } from "../src/data/counties";
import { reverseGeocode } from "../src/lib/geo/reverse-geocode";

interface Probe {
  countyId: string;
  countyName: string;
  label: string;
  lat: number;
  lng: number;
}

// Major-city centers for the most-populated county per region. Picked
// from `data/counties.ts` (county.center is usually the capital city
// already) plus a few notable secondary towns to widen the sample.
const SECONDARY_LOCATIONS: Record<string, Array<[string, number, number]>> = {
  CJ: [["Turda", 46.5683, 23.7861], ["Dej", 47.143, 23.876]],
  IS: [["Pașcani", 47.243, 26.732]],
  TM: [["Lugoj", 45.69, 21.91]],
  BV: [["Făgăraș", 45.844, 24.974]],
  CT: [["Mangalia", 43.815, 28.582], ["Năvodari", 44.318, 28.6]],
  PH: [["Câmpina", 45.125, 25.741], ["Sinaia", 45.348, 25.547]],
  GL: [["Tecuci", 45.85, 27.42]],
  SV: [["Rădăuți", 47.84, 25.91]],
  B: [["Sector 5", 44.42, 26.06], ["Sector 1", 44.487, 26.052]],
  IF: [["Voluntari", 44.49, 26.18]],
};

function buildProbes(quick: boolean): Probe[] {
  const probes: Probe[] = [];
  for (const c of ALL_COUNTIES) {
    probes.push({
      countyId: c.id,
      countyName: c.name,
      label: "center",
      lat: c.center[0],
      lng: c.center[1],
    });
    if (!quick) {
      // Two small offsets around the center — usually still inside the
      // same county, occasionally slipping into a neighbour. A miss
      // here is informative (parser can't disambiguate boundaries) but
      // not necessarily a bug.
      probes.push({
        countyId: c.id,
        countyName: c.name,
        label: "offset+",
        lat: c.center[0] + 0.12,
        lng: c.center[1] + 0.12,
      });
      probes.push({
        countyId: c.id,
        countyName: c.name,
        label: "offset-",
        lat: c.center[0] - 0.12,
        lng: c.center[1] - 0.12,
      });
      for (const [name, lat, lng] of SECONDARY_LOCATIONS[c.id] ?? []) {
        probes.push({ countyId: c.id, countyName: c.name, label: name, lat, lng });
      }
    }
  }
  return probes;
}

async function main() {
  const quick = process.argv.includes("--quick");
  const probes = buildProbes(quick);
  console.log(`Running ${probes.length} probes (quick=${quick})...\n`);

  const passes: typeof probes = [];
  const fails: Array<typeof probes[number] & { gotCode: string | null; gotName: string | null }> = [];

  for (const p of probes) {
    try {
      const res = await reverseGeocode(p.lat, p.lng);
      const ok = res.countyCode === p.countyId;
      const symbol = ok ? "✅" : "❌";
      const gotLabel = res.countyCode ? `${res.countyCode} (${res.countyName})` : "—";
      console.log(
        `${symbol} ${p.countyId.padEnd(2)} ${p.label.padEnd(10)} → ${gotLabel}`,
      );
      if (ok) passes.push(p);
      else fails.push({ ...p, gotCode: res.countyCode, gotName: res.countyName });
    } catch (e) {
      console.log(`⚠  ${p.countyId.padEnd(2)} ${p.label.padEnd(10)} → ERROR: ${e instanceof Error ? e.message : e}`);
      fails.push({ ...p, gotCode: null, gotName: null });
    }
    // Nominatim policy: 1 req/sec. Stay polite.
    await new Promise((r) => setTimeout(r, 1100));
  }

  const total = passes.length + fails.length;
  const rate = ((passes.length / total) * 100).toFixed(1);
  console.log(`\n========================`);
  console.log(`PASSED: ${passes.length}/${total} (${rate}%)`);
  console.log(`========================\n`);

  if (fails.length > 0) {
    console.log("Failures by county:");
    const byCounty = new Map<string, typeof fails>();
    for (const f of fails) {
      const arr = byCounty.get(f.countyId) ?? [];
      arr.push(f);
      byCounty.set(f.countyId, arr);
    }
    for (const [cid, arr] of byCounty) {
      console.log(`  ${cid} (${arr[0]!.countyName}):`);
      for (const f of arr) {
        const got = f.gotCode ? `${f.gotCode} ${f.gotName ? `(${f.gotName})` : ""}` : "no county detected";
        console.log(`    ${f.label.padEnd(12)} @ ${f.lat.toFixed(3)},${f.lng.toFixed(3)} → ${got}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
