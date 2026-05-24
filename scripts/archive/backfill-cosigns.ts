// Backfill `cosemnat` timeline events for sesizari that were re-submitted
// before the cosign feature existed.
//
// Strategy: for each sesizare, look for OTHER sesizari that match
//   - same tip (problem type)
//   - within ~300 m radius (same approach as sesizari_similare RPC)
//   - created strictly after the original
//   - within 60 days after the original (avoid noise from unrelated reports)
// Each match is written as a `cosemnat` timeline row with that match's
// created_at, so the result page shows "Și un alt cetățean a depus
// sesizarea — DD MMM YYYY HH:mm" exactly when the duplicate landed.
//
// Idempotent: skips inserts when a cosemnat row already exists for that
// (sesizare_id, created_at) pair (matched at minute resolution).
//
// Usage:  npx tsx scripts/backfill-cosigns.ts [--dry]

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const RADIUS_M = 300;
const WINDOW_DAYS = 60;
const dryRun = process.argv.includes("--dry");

interface SesizareRow {
  id: string;
  tip: string;
  lat: number;
  lng: number;
  created_at: string;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log("📥 Loading sesizari...");
  const { data: sesizari, error: e1 } = await admin
    .from("sesizari")
    .select("id, tip, lat, lng, created_at")
    .order("created_at", { ascending: true });
  if (e1) throw e1;
  if (!sesizari || sesizari.length === 0) {
    console.log("Niciun sesizare găsită.");
    return;
  }
  console.log(`  ${sesizari.length} sesizari în total.`);

  console.log("📥 Loading existing cosemnat rows so we don't duplicate...");
  const { data: existing, error: e2 } = await admin
    .from("sesizare_timeline")
    .select("sesizare_id, created_at")
    .eq("event_type", "cosemnat");
  if (e2) throw e2;
  // Index existing by (sesizare_id, minute-truncated created_at) so we
  // tolerate small timestamp drift between attempts.
  const existingKey = (sid: string, iso: string) => `${sid}|${iso.slice(0, 16)}`;
  const existingSet = new Set((existing ?? []).map((r) => existingKey(r.sesizare_id, r.created_at)));
  console.log(`  ${existing?.length ?? 0} cosemnat rows existente.`);

  // Group sesizari by tip — radius search is per-tip.
  const byTip = new Map<string, SesizareRow[]>();
  for (const s of sesizari as SesizareRow[]) {
    if (s.lat == null || s.lng == null) continue;
    const arr = byTip.get(s.tip) ?? [];
    arr.push(s);
    byTip.set(s.tip, arr);
  }

  const inserts: { sesizare_id: string; event_type: "cosemnat"; description: string; created_at: string }[] = [];
  const seen = new Set<string>(existingSet);

  // For each sesizare, look at later same-tip sesizari within radius +
  // window. The radius check uses the equirectangular approximation
  // matching sesizari_similare RPC.
  for (const [, group] of byTip) {
    for (let i = 0; i < group.length; i++) {
      const orig = group[i]!;
      const origMs = new Date(orig.created_at).getTime();
      const cutoffMs = origMs + WINDOW_DAYS * 24 * 60 * 60 * 1000;
      for (let j = i + 1; j < group.length; j++) {
        const later = group[j]!;
        const laterMs = new Date(later.created_at).getTime();
        if (laterMs <= origMs) continue;
        if (laterMs > cutoffMs) break; // group sorted by created_at asc

        const dLat = (orig.lat - later.lat) * 111000;
        const dLng = (orig.lng - later.lng) * 111000 * Math.cos((orig.lat * Math.PI) / 180);
        const distM = Math.sqrt(dLat * dLat + dLng * dLng);
        if (distM > RADIUS_M) continue;

        const key = existingKey(orig.id, later.created_at);
        if (seen.has(key)) continue;
        seen.add(key);

        inserts.push({
          sesizare_id: orig.id,
          event_type: "cosemnat",
          description: "Un alt cetățean a depus o sesizare similară în zonă",
          created_at: later.created_at,
        });
      }
    }
  }

  console.log(`\n🧮 De inserat: ${inserts.length} cosemnat rows.`);
  if (inserts.length === 0) {
    console.log("Nimic de făcut.");
    return;
  }

  // Show top-5 sesizari with most backfill events
  const perSesizare = new Map<string, number>();
  for (const ins of inserts) perSesizare.set(ins.sesizare_id, (perSesizare.get(ins.sesizare_id) ?? 0) + 1);
  const top5 = [...perSesizare.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("Top 5 sesizari care primesc backfill:");
  for (const [sid, count] of top5) console.log(`  ${sid}: +${count}`);

  if (dryRun) {
    console.log("\n--dry: nu inserez nimic. Re-rulează fără --dry ca să apliciți.");
    return;
  }

  // Insert in batches of 500
  console.log("\n💾 Insert...");
  let total = 0;
  for (let i = 0; i < inserts.length; i += 500) {
    const chunk = inserts.slice(i, i + 500);
    const { error } = await admin.from("sesizare_timeline").insert(chunk);
    if (error) {
      console.error(`Batch ${i}-${i + chunk.length} a eșuat:`, error.message);
      process.exit(1);
    }
    total += chunk.length;
    process.stdout.write(`  ${total}/${inserts.length}\r`);
  }
  console.log(`\n✅ Inserate ${total} rânduri cosemnat.`);
}

main().catch((e) => {
  console.error("Backfill a eșuat:", e);
  process.exit(1);
});
