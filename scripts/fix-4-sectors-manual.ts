/**
 * Manual fix pentru 4 sesizări încă cu sector=null după backfill regex.
 * Bazat pe lat/lng + name street (lookup manual din DB dump).
 *
 * 00016 Strada Doctor Constantin Istrati 6 (Parc Carol) — Sector 4
 * 00017 Strada Mântuleasa, București — Sector 2
 * 00027 Bd. Națiunile Unite și Strada Poliției — Sector 5
 * 00039 Șoseaua Morarilor, nr. 2 — Sector 2
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const FIXES: Array<{ code: string; sector: string; reason: string }> = [
  { code: "00016", sector: "S4", reason: "Parc Carol — Sector 4" },
  { code: "00017", sector: "S2", reason: "Strada Mantuleasa — Sector 2 (between Mosilor/Eminescu)" },
  { code: "00027", sector: "S5", reason: "Bd. Natiunile Unite x Politiei — Sector 5 (riverside)" },
  { code: "00039", sector: "S2", reason: "Soseaua Morarilor — Sector 2" },
];

async function main() {
  for (const f of FIXES) {
    const { error } = await sa.from("sesizari").update({ sector: f.sector }).eq("code", f.code);
    console.log(`${f.code} -> ${f.sector} (${f.reason}) ${error ? "FAIL: " + error.message : "OK"}`);
  }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
