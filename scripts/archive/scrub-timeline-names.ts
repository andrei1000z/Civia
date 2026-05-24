/**
 * 2026-05-24 PRIVACY FIX — scrub retroactiv pe sesizare_timeline.
 *
 * Bug raportat user: pe /sesizari/00048 apărea „Eduard Andrei Mușat a trimis
 * și el această sesizare către autorități prin Civia." — leak nume full.
 *
 * Cauza: vechi versiuni ale cosign + send-via-civia endpoint-uri inserau
 * description cu nume cetățean. Acum sunt anonime, dar event-urile vechi
 * rămân în DB cu nume.
 *
 * Fix:
 *   1. Anonimizez description pe toate event-urile trimis_via_civia + cosemnat
 *      care conțin nume (orice rând cu „a trimis și el", „a co-semnat" etc.)
 *   2. Description nouă: generic + numeric (number of authorities sau cosignatures)
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
  // Toate event-urile cosign_send + trimis_via_civia (legacy alias)
  const { data: trimiteri } = await sa
    .from("sesizare_timeline")
    .select("id, sesizare_id, description, created_by, event_type")
    .in("event_type", ["cosign_send", "trimis_via_civia"]);

  console.log(`📨 cosign_send + trimis_via_civia events: ${trimiteri?.length ?? 0}`);
  let trimSanitized = 0;
  for (const t of (trimiteri ?? []) as Array<{ id: string; sesizare_id: string; description: string | null; created_by: string | null; event_type: string }>) {
    if (!t.description) continue;
    // Anonimizăm TOATE descrierile — chiar dacă nu au nume explicit, pentru consistență.
    await sa
      .from("sesizare_timeline")
      .update({
        description: "Un cetățean a co-semnat și a trimis acest email către autorități prin Civia.",
      })
      .eq("id", t.id);
    trimSanitized += 1;
    console.log(`  ✓ Sanitized ${t.event_type} #${t.id.slice(0, 8)}`);
  }

  // Cosemnat events — anonimizez totale
  const { data: cosemne } = await sa
    .from("sesizare_timeline")
    .select("id, description")
    .eq("event_type", "cosemnat");

  console.log(`\n✍️ cosemnat events: ${cosemne?.length ?? 0}`);
  let cosSanitized = 0;
  for (const c of (cosemne ?? []) as Array<{ id: string; description: string | null }>) {
    if (!c.description) continue;
    const hasName = /[A-ZȘȚĂÂÎ][a-zșțăâî]+(?:\s+[A-ZȘȚĂÂÎ][a-zșțăâî]+){1,3}/.test(c.description);
    if (hasName || c.description !== "Un alt cetățean a co-semnat această sesizare") {
      await sa
        .from("sesizare_timeline")
        .update({ description: "Un alt cetățean a co-semnat această sesizare" })
        .eq("id", c.id);
      cosSanitized += 1;
    }
  }

  console.log(`\n✨ Done. Sanitized: ${trimSanitized} trimiteri, ${cosSanitized} cosemne.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
