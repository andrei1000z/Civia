/**
 * Wave 2 — Cleanup batch:
 * 1. author_address pentru 00048 (Calapod Bogdan) și 00002 (Theodoroviciu)
 *    extrage din profile dacă există, altfel null e ok.
 * 2. Verifică ce sectoare lipsesc pentru 4 sesizări încă null.
 * 3. Re-classify tip pentru 3 sesizări mis-clasificate:
 *    - 00023 „Groapă pe trotuar" trotuar → groapa
 *    - 00024 „Gard tramvai" stalpisori → mobilier (sau ramane)
 *    - 00036 „Mașini banda autobuz" stalpisori → banda_transport
 * 4. Standardize display_name pentru vremschimbare ≡ Vrem Schimbare.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function reclassifyTip() {
  console.log("\n🏷️  Re-clasificare tip pe 3 sesizări:");
  const updates = [
    { code: "00023", from: "trotuar", to: "groapa", reason: `Groapă periculoasă pe trotuar` },
    { code: "00036", from: "stalpisori", to: "banda_transport", reason: `Mașini pe banda autobuz Panduri` },
    // 00024 ramane stalpisori (gard despărțitor = adjacent tematic)
  ];
  for (const u of updates) {
    const { error } = await sa
      .from("sesizari")
      .update({ tip: u.to })
      .eq("code", u.code)
      .eq("tip", u.from);
    console.log(`  ${u.code}: ${u.from} → ${u.to} (${u.reason}) ${error ? "❌ " + error.message : "✅"}`);
  }
}

async function checkRemainingSectorsNull() {
  console.log("\n📍 Sesizări încă cu sector=null:");
  const { data } = await sa
    .from("sesizari")
    .select("code, locatie, titlu, lat, lng")
    .is("sector", null)
    .order("code", { ascending: true });
  for (const r of (data ?? []) as Array<{ code: string; locatie: string; titlu: string; lat: number; lng: number }>) {
    console.log(`  ${r.code} (${r.lat}, ${r.lng}) — ${r.locatie.slice(0, 80)}`);
  }
  console.log("  → Pentru ele: point-in-polygon Bucharest sectors GeoJSON (deferred).");
}

async function unifyVremschimbare() {
  console.log("\n🔧 Unify display_name pentru activcivic@gmail.com:");
  const { data: profiles } = await sa
    .from("profiles")
    .select("id, display_name")
    .ilike("display_name", "%vrem%schimbare%");
  for (const p of (profiles ?? []) as Array<{ id: string; display_name: string }>) {
    if (p.display_name !== "Vrem Schimbare") {
      await sa.from("profiles").update({ display_name: "Vrem Schimbare" }).eq("id", p.id);
      console.log(`  ${p.id}: ${p.display_name} -> Vrem Schimbare`);
    }
  }
  // Synchronize sesizari.author_display_name as well
  const { data: sesizari } = await sa
    .from("sesizari")
    .select("id, code, author_name, author_display_name")
    .ilike("author_name", "%vrem%schimbare%");
  for (const s of (sesizari ?? []) as Array<{ id: string; code: string; author_name: string; author_display_name: string | null }>) {
    if (s.author_display_name !== "Vrem Schimbare") {
      await sa
        .from("sesizari")
        .update({ author_name: "Vrem Schimbare", author_display_name: "Vrem" })
        .eq("id", s.id);
      console.log(`  Sesizare ${s.code}: author_name -> Vrem Schimbare`);
    }
  }
}

async function backfillAuthorAddress() {
  console.log("\n📬 Backfill author_address pentru sesizările cu user_id:");
  const { data: missing } = await sa
    .from("sesizari")
    .select("id, code, user_id, author_name, author_address")
    .is("author_address", null);
  for (const s of (missing ?? []) as Array<{ id: string; code: string; user_id: string | null; author_name: string; author_address: string | null }>) {
    if (!s.user_id) {
      console.log(`  ${s.code} (${s.author_name}): nu are user_id, skip`);
      continue;
    }
    const { data: profile } = await sa.from("profiles").select("address").eq("id", s.user_id).maybeSingle();
    const addr = (profile as { address?: string | null } | null)?.address?.trim();
    if (addr) {
      await sa.from("sesizari").update({ author_address: addr }).eq("id", s.id);
      console.log(`  ${s.code}: ok author_address = ${addr}`);
    } else {
      console.log(`  ${s.code}: profile.address null, skip`);
    }
  }
}

async function main() {
  await reclassifyTip();
  await checkRemainingSectorsNull();
  await unifyVremschimbare();
  await backfillAuthorAddress();
  console.log("\n✨ Wave 2 cleanup done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
