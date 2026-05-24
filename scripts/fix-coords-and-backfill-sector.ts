/**
 * P0.3 + P0.4: Fix coordonate #44 + backfill `sector` NULL.
 *
 * 1. Sesizarea 00044 are coordonate la Sibiu (45.9432, 24.9668) — locația
 *    zice „București Sector 5 Abator". Punem (44.4275, 26.0958) =
 *    Splaiul Unirii × Abator (Sector 5).
 *
 * 2. Backfill `sector` pentru toate sesizările cu sector=null și locație
 *    care conține „Sector X" sau cuvinte cheie din SECTOR_KEYWORDS.
 *    Folosește detectSectorFromText() ca în formularul nou.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { detectSectorFromText } from "../src/lib/sesizari/sector-detect";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function fix44() {
  console.log("🛰️  Fix #44 coordonate Sibiu → București Sector 5...");
  const { data: cur } = await sa.from("sesizari").select("id, code, lat, lng, locatie, sector").eq("code", "00044").maybeSingle();
  if (!cur) {
    console.log("  ❌ Nu am găsit 00044");
    return;
  }
  console.log(`  📍 Înainte: ${cur.lat}, ${cur.lng} (locație: ${cur.locatie}, sector: ${cur.sector ?? "null"})`);
  const { error } = await sa
    .from("sesizari")
    .update({ lat: 44.4275, lng: 26.0958, sector: "S5" })
    .eq("code", "00044");
  if (error) {
    console.log(`  ❌ Update eșuat: ${error.message}`);
  } else {
    console.log(`  ✅ Actualizat: 44.4275, 26.0958 (Splaiul Unirii × Abator, Sector 5)`);
  }
}

async function backfillSector() {
  console.log("\n🏷️  Backfill sector NULL...");
  const { data: rows, error } = await sa
    .from("sesizari")
    .select("id, code, locatie, descriere, titlu, sector")
    .is("sector", null);
  if (error) {
    console.log(`  ❌ Query eșuat: ${error.message}`);
    return;
  }
  const candidates = (rows ?? []) as Array<{
    id: string; code: string; locatie: string; descriere: string; titlu: string;
  }>;
  console.log(`  📊 ${candidates.length} sesizări cu sector=null`);

  let updated = 0;
  let stillNull = 0;
  for (const r of candidates) {
    // Concatenăm tot text-ul disponibil: titlu + locație + descriere
    const combinedText = `${r.titlu} ${r.locatie} ${r.descriere}`;
    const detected = detectSectorFromText(combinedText);
    if (!detected) {
      stillNull += 1;
      console.log(`    ⚪ ${r.code}: încă null — locație: ${r.locatie.slice(0, 70)}`);
      continue;
    }
    const { error: updErr } = await sa
      .from("sesizari")
      .update({ sector: detected })
      .eq("id", r.id);
    if (updErr) {
      console.log(`    ❌ ${r.code} update fail: ${updErr.message}`);
      continue;
    }
    updated += 1;
    console.log(`    ✅ ${r.code} → ${detected}  (locație: ${r.locatie.slice(0, 60)})`);
  }
  console.log(`\n  📈 Total: ${updated} actualizate, ${stillNull} încă null`);
}

async function main() {
  await fix44();
  await backfillSector();
  console.log("\n✨ Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
