/**
 * Listează TOATE emailurile primite pe sesizari@civia.ro.
 * Date din `sesizare_replies` (procesate de webhook /api/inbox/reply).
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface Reply {
  id: string;
  sesizare_id: string | null;
  from_email: string;
  from_name: string | null;
  authority_name: string | null;
  subject: string | null;
  body_text: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_nr_inregistrare: string | null;
  auto_applied: boolean | null;
  trusted_sender: boolean | null;
  received_at: string;
}

async function main() {
  const { data, error, count } = await sa
    .from("sesizare_replies")
    .select("*", { count: "exact" })
    .order("received_at", { ascending: false });

  if (error) {
    console.error("Eroare:", error);
    return;
  }

  const replies = (data ?? []) as Reply[];
  console.log(`\n📬 Total emailuri primite la sesizari@civia.ro: ${count ?? 0}\n`);

  if (replies.length === 0) {
    console.log("  (niciun email indexat)");
    return;
  }

  // Look up sesizare codes
  const sesizareIds = Array.from(new Set(replies.map((r) => r.sesizare_id).filter(Boolean) as string[]));
  const { data: sesizari } = await sa
    .from("sesizari")
    .select("id, code, titlu")
    .in("id", sesizareIds);
  const sesMap = new Map<string, { code: string; titlu: string }>();
  for (const s of (sesizari ?? []) as { id: string; code: string; titlu: string }[]) {
    sesMap.set(s.id, { code: s.code, titlu: s.titlu });
  }

  for (let i = 0; i < replies.length; i++) {
    const r = replies[i]!;
    const ses = r.sesizare_id ? sesMap.get(r.sesizare_id) : null;
    console.log("═".repeat(90));
    console.log(`#${i + 1}  📅 ${r.received_at}`);
    console.log(`    📧 From: ${r.from_name ? `${r.from_name} <${r.from_email}>` : r.from_email}`);
    if (ses) {
      console.log(`    🎫 Sesizare: ${ses.code} — ${ses.titlu}`);
    } else if (r.sesizare_id) {
      console.log(`    🎫 Sesizare ID: ${r.sesizare_id} (titlu indisponibil)`);
    } else {
      console.log(`    🎫 (no match — code not extracted)`);
    }
    if (r.authority_name) console.log(`    🏛️  Autoritate: ${r.authority_name}`);
    console.log(`    📌 Subject: ${r.subject ?? "(no subject)"}`);
    console.log(`    🤖 AI: ${r.ai_status} (confidence ${r.ai_confidence ?? "?"}%) ${r.auto_applied ? "→ auto-aplicat" : ""}`);
    if (r.ai_summary) console.log(`    💡 Summary: ${r.ai_summary}`);
    if (r.ai_nr_inregistrare) console.log(`    📋 Nr înregistrare: ${r.ai_nr_inregistrare}`);
    console.log(`    ✓ Trusted sender: ${r.trusted_sender ? "yes" : "no"}`);
    if (r.body_text) {
      const preview = r.body_text.slice(0, 300).replace(/\n+/g, " ").trim();
      console.log(`    📝 Body: ${preview}${r.body_text.length > 300 ? "..." : ""}`);
    }
  }
  console.log("═".repeat(90));

  // Aggregate stats
  const byAuthority = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const r of replies) {
    const auth = r.authority_name ?? r.from_email.split("@")[1] ?? "unknown";
    byAuthority.set(auth, (byAuthority.get(auth) ?? 0) + 1);
    const s = r.ai_status ?? "unknown";
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }

  console.log("\n📊 Pe domeniu/autoritate:");
  for (const [auth, count] of [...byAuthority.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${auth}: ${count}`);
  }
  console.log("\n📊 Pe AI status:");
  for (const [s, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s}: ${count}`);
  }
}
main();
