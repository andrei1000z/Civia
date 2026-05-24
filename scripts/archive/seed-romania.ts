// Seed Romania counties + auto-generate IPJ/ISU/prefectura authorities.
// Usage: npx tsx scripts/seed-romania.ts
// Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// All 41 counties + București with codes, names, approximate center coords
const COUNTIES: { id: string; name: string; lat: number; lng: number }[] = [
  { id: "AB", name: "Alba", lat: 46.07, lng: 23.58 },
  { id: "AR", name: "Arad", lat: 46.18, lng: 21.32 },
  { id: "AG", name: "Argeș", lat: 44.86, lng: 24.87 },
  { id: "BC", name: "Bacău", lat: 46.57, lng: 26.91 },
  { id: "BH", name: "Bihor", lat: 47.05, lng: 21.93 },
  { id: "BN", name: "Bistrița-Năsăud", lat: 47.13, lng: 24.50 },
  { id: "BT", name: "Botoșani", lat: 47.75, lng: 26.67 },
  { id: "BR", name: "Brăila", lat: 45.27, lng: 27.96 },
  { id: "BV", name: "Brașov", lat: 45.65, lng: 25.61 },
  { id: "BZ", name: "Buzău", lat: 45.15, lng: 26.83 },
  { id: "CL", name: "Călărași", lat: 44.20, lng: 26.99 },
  { id: "CS", name: "Caraș-Severin", lat: 45.30, lng: 21.90 },
  { id: "CJ", name: "Cluj", lat: 46.77, lng: 23.60 },
  { id: "CT", name: "Constanța", lat: 44.18, lng: 28.63 },
  { id: "CV", name: "Covasna", lat: 45.87, lng: 26.00 },
  { id: "DB", name: "Dâmbovița", lat: 44.93, lng: 25.46 },
  { id: "DJ", name: "Dolj", lat: 44.33, lng: 23.80 },
  { id: "GL", name: "Galați", lat: 45.44, lng: 28.05 },
  { id: "GJ", name: "Gorj", lat: 45.05, lng: 23.28 },
  { id: "GR", name: "Giurgiu", lat: 43.90, lng: 25.97 },
  { id: "HR", name: "Harghita", lat: 46.36, lng: 25.80 },
  { id: "HD", name: "Hunedoara", lat: 45.75, lng: 22.90 },
  { id: "IL", name: "Ialomița", lat: 44.56, lng: 26.93 },
  { id: "IS", name: "Iași", lat: 47.16, lng: 27.58 },
  { id: "IF", name: "Ilfov", lat: 44.47, lng: 26.12 },
  { id: "MM", name: "Maramureș", lat: 47.66, lng: 24.00 },
  { id: "MH", name: "Mehedinți", lat: 44.63, lng: 22.66 },
  { id: "MS", name: "Mureș", lat: 46.55, lng: 24.56 },
  { id: "NT", name: "Neamț", lat: 46.93, lng: 26.37 },
  { id: "OT", name: "Olt", lat: 44.43, lng: 24.36 },
  { id: "PH", name: "Prahova", lat: 44.95, lng: 25.95 },
  { id: "SJ", name: "Sălaj", lat: 47.20, lng: 23.05 },
  { id: "SM", name: "Satu Mare", lat: 47.79, lng: 22.89 },
  { id: "SB", name: "Sibiu", lat: 45.80, lng: 24.15 },
  { id: "SV", name: "Suceava", lat: 47.63, lng: 26.26 },
  { id: "TR", name: "Teleorman", lat: 43.98, lng: 25.36 },
  { id: "TM", name: "Timiș", lat: 45.75, lng: 21.23 },
  { id: "TL", name: "Tulcea", lat: 45.18, lng: 28.80 },
  { id: "VL", name: "Vâlcea", lat: 45.10, lng: 24.37 },
  { id: "VS", name: "Vaslui", lat: 46.64, lng: 27.73 },
  { id: "VN", name: "Vrancea", lat: 45.70, lng: 27.18 },
  { id: "B", name: "București", lat: 44.43, lng: 26.10 },
];

// IPJ code mapping (lowercase county codes used in email pattern)
const IPJ_CODES: Record<string, string> = {
  AB: "ab", AR: "ar", AG: "ag", BC: "bc", BH: "bh", BN: "bn", BT: "bt",
  BR: "br", BV: "bv", BZ: "bz", CL: "cl", CS: "cs", CJ: "cj", CT: "ct",
  CV: "cv", DB: "db", DJ: "dj", GL: "gl", GJ: "gj", GR: "gr", HR: "hr",
  HD: "hd", IL: "il", IS: "is", IF: "if", MM: "mm", MH: "mh", MS: "ms",
  NT: "nt", OT: "ot", PH: "ph", SJ: "sj", SM: "sm", SB: "sb", SV: "sv",
  TR: "tr", TM: "tm", TL: "tl", VL: "vl", VS: "vs", VN: "vn", B: "b",
};

async function run() {
  console.log("🇷🇴 Seeding Romania counties + authorities...\n");

  // 1. Insert counties
  console.log("→ Inserting 42 counties...");
  const { error: countyErr } = await supabase
    .from("counties")
    .upsert(
      COUNTIES.map((c) => ({
        id: c.id,
        name: c.name,
        center_lat: c.lat,
        center_lng: c.lng,
      })),
      { onConflict: "id" }
    );
  if (countyErr) {
    console.error("❌ County insert error:", countyErr.message);
    return;
  }
  console.log("✓ 42 counties inserted");

  // 2. Insert București sectors as localities
  console.log("→ Inserting București sectors...");
  const sectors = Array.from({ length: 6 }, (_, i) => ({
    id: `B-S${i + 1}`,
    name: `Sectorul ${i + 1}`,
    type: "sector" as const,
    county_id: "B",
    lat: 44.43 + (i < 3 ? 0.02 : -0.02),
    lng: 26.10 + (i % 3 - 1) * 0.05,
  }));
  const { error: sectorErr } = await supabase
    .from("localities")
    .upsert(sectors, { onConflict: "id" });
  if (sectorErr) console.error("⚠️ Sector insert:", sectorErr.message);
  else console.log("✓ 6 sectors inserted");

  // 3. Generate authorities per county
  console.log("→ Generating authorities...");
  const authorities: {
    name: string;
    type: string;
    email: string | null;
    county_id: string;
    verified: boolean;
  }[] = [];

  for (const county of COUNTIES) {
    const code = IPJ_CODES[county.id];

    // IPJ — email pattern is predictable
    authorities.push({
      name: `IPJ ${county.name}`,
      type: "ipj",
      email: `cabinet@${code}.politiaromana.ro`,
      county_id: county.id,
      verified: true,
    });

    // ISU
    authorities.push({
      name: `ISU ${county.name}`,
      type: "isu",
      email: null, // varies per county, not predictable
      county_id: county.id,
      verified: false,
    });

    // Prefectura
    authorities.push({
      name: `Prefectura ${county.name}`,
      type: "prefectura",
      email: null, // needs manual research per county
      county_id: county.id,
      verified: false,
    });

    // Consiliul Județean (not for București)
    if (county.id !== "B") {
      authorities.push({
        name: `Consiliul Județean ${county.name}`,
        type: "consiliu_judetean",
        email: null,
        county_id: county.id,
        verified: false,
      });
    }

    // APM
    authorities.push({
      name: `APM ${county.name}`,
      type: "apm",
      email: null,
      county_id: county.id,
      verified: false,
    });

    // DSP
    authorities.push({
      name: `DSP ${county.name}`,
      type: "dsp",
      email: null,
      county_id: county.id,
      verified: false,
    });
  }

  // Insert in batches
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < authorities.length; i += batchSize) {
    const batch = authorities.slice(i, i + batchSize);
    const { error } = await supabase
      .from("authorities")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error(`⚠️ Batch ${i / batchSize + 1} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`✓ ${inserted} authorities generated (${COUNTIES.length} × 6 types)`);

  // 4. Add București-specific authorities (existing ones from constants.ts)
  console.log("→ Adding București-specific authorities...");
  const bucuresti = [
    { name: "Primăria Municipiului București", type: "primarie", email: "relatii_publice@pmb.ro", county_id: "B", locality_id: null, verified: true },
    { name: "Dispecerat PMB", type: "primarie", email: "dispecerat@pmb.ro", county_id: "B", locality_id: null, verified: true },
    { name: "Poliția Locală București", type: "politie_locala", email: "office@politialocalasector1.ro", county_id: "B", locality_id: null, verified: false },
    { name: "ALPAB", type: "other", email: "office@alpab.ro", county_id: "B", locality_id: null, verified: true },
    { name: "Administrația Străzilor", type: "other", email: "office@astrazi.ro", county_id: "B", locality_id: null, verified: true },
  ];
  const { error: bErr } = await supabase
    .from("authorities")
    .upsert(bucuresti, { onConflict: "id", ignoreDuplicates: true });
  if (bErr) console.error("⚠️ București authorities:", bErr.message);
  else console.log(`✓ ${bucuresti.length} București authorities added`);

  console.log("\n✅ Romania seed complete!");
  console.log(`   Counties: ${COUNTIES.length}`);
  console.log(`   Authorities: ${authorities.length + bucuresti.length}`);
  console.log("\n📋 Next steps:");
  console.log("   1. Run migration 010 in Supabase SQL Editor");
  console.log("   2. Run this script: npx tsx scripts/seed-romania.ts");
  console.log("   3. Import SIRUTA localities (3200+ UAT-uri) — separate script");
  console.log("   4. Import primării emails from GitHub repo");
}

run().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
