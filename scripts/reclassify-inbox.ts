/**
 * scripts/reclassify-inbox.ts
 *
 * 2026-05-29 — Re-clasifică TOATE răspunsurile existente din sesizare_replies
 * folosind noua logică din @/lib/inbox/classify.ts.
 *
 * Run: npx tsx scripts/reclassify-inbox.ts
 *
 * Needs in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GROQ_API_KEY
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { classifyReply } from "../src/lib/inbox/classify.ts";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ReplyRow {
  id: string;
  subject: string | null;
  body_text: string | null;
  from_email: string | null;
  from_name: string | null;
  authority_name: string | null;
  trusted_sender: boolean | null;
  ai_input_text: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
}

async function main() {
  if (!URL || !KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("sesizare_replies")
    .select(
      "id, subject, body_text, from_email, from_name, authority_name, trusted_sender, ai_input_text, ai_status, ai_confidence",
    )
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Fetch error:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as ReplyRow[];
  console.log(`Found ${rows.length} replies. Reclassifying...`);

  const stats = {
    total: rows.length,
    reclassified: 0,
    changed_status: 0,
    by_old_status: {} as Record<string, number>,
    by_new_status: {} as Record<string, number>,
    by_source: {} as Record<string, number>,
    errors: 0,
  };

  for (const row of rows) {
    const oldStatus = row.ai_status ?? "(null)";
    stats.by_old_status[oldStatus] = (stats.by_old_status[oldStatus] ?? 0) + 1;
    try {
      const inputBody = row.ai_input_text || row.body_text;
      const cls = await classifyReply({
        subject: row.subject,
        body: inputBody,
        sender_name: row.authority_name ?? row.from_name ?? row.from_email,
        authority_hint: row.authority_name,
        trusted_sender: row.trusted_sender === true,
      });
      stats.reclassified++;
      stats.by_new_status[cls.status] = (stats.by_new_status[cls.status] ?? 0) + 1;
      stats.by_source[cls.source ?? "unknown"] =
        (stats.by_source[cls.source ?? "unknown"] ?? 0) + 1;

      // 2026-05-29 — DEFENSIVE: skip update daca classifier returneaza
      // FALLBACK (AI esuat) SAU daca downgrade-uim un status deja stabilit
      // (inregistrata cu confidence > 70) la necunoscut. Asta previne
      // pierderea statusurilor corecte cand AI fluctuates.
      const isFallback = cls.source === "fallback";
      const wouldDowngrade =
        cls.status === "necunoscut" &&
        oldStatus !== "necunoscut" &&
        (row.ai_confidence ?? 0) >= 70;
      if (isFallback || wouldDowngrade) {
        process.stdout.write(`${oldStatus.slice(0, 4)}→SKIP(${cls.source}) `);
        continue;
      }

      if (cls.status !== oldStatus) stats.changed_status++;

      const { error: upErr } = await supabase
        .from("sesizare_replies")
        .update({
          ai_status: cls.status,
          ai_confidence: cls.confidence,
          ai_nr_inregistrare: cls.nr_inregistrare,
          ai_summary: cls.summary,
          ai_deadline: cls.deadline,
          ai_suggested_action: cls.suggested_action,
          ai_raw_response: cls.raw ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (upErr) {
        console.error(`  Update failed for ${row.id}:`, upErr.message);
        stats.errors++;
      } else {
        process.stdout.write(`${oldStatus.slice(0, 4)}→${cls.status.slice(0, 4)}(${cls.confidence},${cls.source}) `);
      }
    } catch (e) {
      console.error(`  Classify failed for ${row.id}:`, e instanceof Error ? e.message : e);
      stats.errors++;
    }
  }

  console.log("\n\n=== DONE ===");
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
