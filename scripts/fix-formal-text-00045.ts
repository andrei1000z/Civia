/**
 * Repair formal_text pentru sesizarea 00045 (Adrian).
 * AI a generat „Mă numesc Adrian. Doresc..." fără adresa, pentru că
 * la generation time profilul nu avea adresa setată.
 *
 * Acum populăm cu „Mă numesc Adrian, locuiesc în {author_address}, și
 * doresc..." dacă author_address e disponibilă.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: s, error } = await sa
    .from("sesizari")
    .select("id, code, user_id, author_name, formal_text")
    .eq("code", "00045")
    .maybeSingle();
  if (error || !s) {
    console.error("Nu s-a găsit 00045:", error);
    return;
  }
  const sesizareBase = s as {
    id: string;
    code: string;
    user_id: string | null;
    author_name: string;
    formal_text: string | null;
  };
  // 5/22/2026 — coloana author_address pe sesizari nu e încă în DB
  // (migration 060 pending). Citim din profiles până se aplică.
  let author_address: string | null = null;
  if (sesizareBase.user_id) {
    const { data: profile } = await sa
      .from("profiles")
      .select("address")
      .eq("id", sesizareBase.user_id)
      .maybeSingle();
    author_address = (profile as { address: string | null } | null)?.address ?? null;
  }
  const sesizare = { ...sesizareBase, author_address };

  console.log(`\n📋 Sesizare 00045 — ${sesizare.author_name}`);
  console.log(`   Adresa DB: ${sesizare.author_address ?? "(LIPSĂ)"}`);
  console.log(`\n📄 Formal text vechi (primele 200 chars):`);
  console.log("─".repeat(70));
  console.log((sesizare.formal_text ?? "").slice(0, 200));
  console.log("─".repeat(70));

  if (!sesizare.author_address) {
    console.log("\n⚠️  Nu pot repara — author_address e null pe sesizare.");
    console.log("    User-ul trebuie să-și completeze adresa în profil.");
    return;
  }

  if (!sesizare.formal_text) {
    console.log("\n⚠️  formal_text e null — nu pot repara.");
    return;
  }

  // Pattern: „Mă numesc Adrian." sau „Mă numesc Adrian " urmat de un verb
  // (fără „locuiesc"). Rewrite la „Mă numesc Adrian, locuiesc în {addr},".
  const repaired = sesizare.formal_text.replace(
    /M[ăa]\s+numesc\s+([A-ZĂÂÎȘȚ][^,.\n]*?)\s*\.(?=\s+[A-ZĂÂÎȘȚ])/,
    (_match, capturedName) => {
      const cleanName = capturedName.trim();
      return `Mă numesc ${cleanName}, locuiesc în ${sesizare.author_address},`;
    },
  );

  if (repaired === sesizare.formal_text) {
    console.log("\n⚠️  Pattern nu match — formal_text deja are formatul corect sau e diferit.");
    return;
  }

  console.log("\n✅ Repaired (primele 200 chars):");
  console.log("─".repeat(70));
  console.log(repaired.slice(0, 200));
  console.log("─".repeat(70));

  if (!process.argv.includes("--apply")) {
    console.log("\n⚠️  Dry run. Rulează cu --apply ca să salvezi:");
    console.log("    npx tsx scripts/fix-formal-text-00045.ts --apply");
    return;
  }

  const { error: updateErr } = await sa
    .from("sesizari")
    .update({ formal_text: repaired })
    .eq("id", sesizare.id);
  if (updateErr) {
    console.error("\n❌ Update failed:", updateErr);
    return;
  }
  console.log("\n✅ DB actualizat. Reîncarcă pagina civia.ro/sesizari/00045.");
}
main();
