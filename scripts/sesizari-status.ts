/**
 * Snapshot: ce s-a trimis prin sesizari@civia.ro + ce s-a primit înapoi.
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
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📤 SESIZĂRI TRIMISE PRIN sesizari@civia.ro");
  console.log("═══════════════════════════════════════════════════════════\n");

  const { data: sent, error: sentErr, count: sentCount } = await sa
    .from("sesizari")
    .select(
      "code, tip, titlu, locatie, sector, county, locality, author_name, author_email, sent_to_emails, resend_message_id, sent_at, status, moderation_status, official_response, official_response_at, nr_inregistrare, descriere",
      { count: "exact" },
    )
    .eq("sent_via_civia", true)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (sentErr) {
    console.log("❌", sentErr.message);
  } else {
    console.log(`✓ Total trimise: ${sentCount}\n`);
    for (const s of sent ?? []) {
      const data = s.sent_at
        ? new Date(s.sent_at).toLocaleString("ro-RO")
        : "—";
      console.log(`📨 [${s.code}] ${data}`);
      console.log(`   Tip:        ${s.tip}`);
      console.log(`   Titlu:      ${s.titlu ?? "—"}`);
      console.log(`   Locație:    ${s.locatie}${s.sector ? `, S${s.sector}` : ""}${s.locality ? `, ${s.locality}` : ""}${s.county ? `, ${s.county}` : ""}`);
      console.log(`   De la:      ${s.author_name} <${s.author_email ?? "—"}>`);
      const recip = Array.isArray(s.sent_to_emails)
        ? s.sent_to_emails.join(", ")
        : "—";
      console.log(`   Către:      ${recip}`);
      console.log(`   Resend ID:  ${s.resend_message_id ?? "—"}`);
      console.log(`   Status:     ${s.status}${s.moderation_status !== "approved" ? ` (mod: ${s.moderation_status})` : ""}`);
      if (s.nr_inregistrare) console.log(`   Nr înreg:   ${s.nr_inregistrare}`);
      if (s.official_response) {
        const respDate = s.official_response_at
          ? new Date(s.official_response_at).toLocaleString("ro-RO")
          : "—";
        console.log(`   ✓ Răspuns oficial primit (${respDate}):`);
        console.log(
          `     ${(s.official_response as string).replace(/\s+/g, " ").slice(0, 200)}`,
        );
      }
      console.log("");
    }
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("📥 RĂSPUNSURI PRIMITE (sesizare_replies)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const { data: replies, error: repErr, count: repCount } = await sa
    .from("sesizare_replies")
    .select(
      "id, sesizare_id, from_email, from_name, authority_name, subject, body_text, received_at, ai_status, ai_confidence, ai_summary, ai_nr_inregistrare, ai_deadline, trusted_sender, auto_applied",
      { count: "exact" },
    )
    .order("received_at", { ascending: false })
    .limit(50);

  if (repErr) {
    console.log("❌", repErr.message);
  } else {
    console.log(`✓ Total în DB: ${repCount}\n`);
    if (!replies || replies.length === 0) {
      console.log("   (niciun răspuns încă — primăriile sunt lente)\n");
    } else {
      const sesizareIds = Array.from(
        new Set(replies.map((r) => r.sesizare_id).filter(Boolean) as string[]),
      );
      const { data: sesIdMap } = await sa
        .from("sesizari")
        .select("id, code")
        .in("id", sesizareIds);
      const codeByid = new Map(
        (sesIdMap ?? []).map((s: { id: string; code: string }) => [s.id, s.code]),
      );
      for (const r of replies) {
        const data = new Date(r.received_at).toLocaleString("ro-RO");
        const code = codeByid.get(r.sesizare_id ?? "") ?? "—";
        console.log(`📩 [${code}] ${data}`);
        console.log(
          `   De la:      ${r.from_name ?? "—"} <${r.from_email}>${r.authority_name ? ` (${r.authority_name})` : ""}${r.trusted_sender ? " ✓ trusted" : ""}`,
        );
        console.log(`   Subiect:    ${(r.subject || "—").slice(0, 90)}`);
        const aiBits: string[] = [];
        if (r.ai_status) aiBits.push(r.ai_status);
        if (r.ai_confidence != null) aiBits.push(`${r.ai_confidence}%`);
        if (r.ai_nr_inregistrare) aiBits.push(`Nr înreg: ${r.ai_nr_inregistrare}`);
        if (r.ai_deadline) aiBits.push(`Deadline: ${r.ai_deadline}`);
        if (r.auto_applied) aiBits.push("auto-applied");
        if (aiBits.length > 0) console.log(`   AI:         ${aiBits.join(" · ")}`);
        if (r.ai_summary) console.log(`   Sumar:      ${r.ai_summary.slice(0, 160)}`);
        if (r.body_text) {
          console.log(
            `   Body:       ${(r.body_text as string).replace(/\s+/g, " ").slice(0, 200)}`,
          );
        }
        console.log("");
      }
    }
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊 STATS GLOBAL");
  console.log("═══════════════════════════════════════════════════════════\n");

  const { count: totalSesizari } = await sa
    .from("sesizari")
    .select("*", { count: "exact", head: true });
  const { count: sentViaCivia } = await sa
    .from("sesizari")
    .select("*", { count: "exact", head: true })
    .eq("sent_via_civia", true);
  const { count: withResponse } = await sa
    .from("sesizari")
    .select("*", { count: "exact", head: true })
    .not("official_response", "is", null);
  const { count: withInregNumber } = await sa
    .from("sesizari")
    .select("*", { count: "exact", head: true })
    .not("nr_inregistrare", "is", null);
  const { count: replyCount } = await sa
    .from("sesizare_replies")
    .select("*", { count: "exact", head: true });

  console.log(`   Total sesizări:                  ${totalSesizari}`);
  console.log(`   Trimise via sesizari@civia.ro:   ${sentViaCivia}`);
  console.log(`   Cu nr. înregistrare oficial:     ${withInregNumber}`);
  console.log(`   Cu răspuns oficial primit:       ${withResponse}`);
  console.log(`   Replies în sesizare_replies:     ${replyCount}`);
  console.log("");

  // Inbox debug log — vede dacă au sosit email-uri inbound chiar dacă nu
  // s-au matched la nicio sesizare existentă.
  const { count: inboxLogCount } = await sa
    .from("inbox_debug_log")
    .select("*", { count: "exact", head: true });
  console.log(`   Email-uri inbound processate (log): ${inboxLogCount}`);

  if ((inboxLogCount ?? 0) > 0) {
    const { data: lastLog } = await sa
      .from("inbox_debug_log")
      .select("endpoint, source, http_status, source_ip, error_message, received_at, request_body")
      .order("received_at", { ascending: false })
      .limit(15);
    console.log("\n   Ultimele 15 evenimente inbox:");
    for (const l of lastLog ?? []) {
      const ts = new Date(l.received_at).toLocaleString("ro-RO");
      const ok = (l.http_status as number | null) ?? 0;
      const flag = ok >= 200 && ok < 300 ? "✓" : "✗";
      console.log(
        `     ${flag} ${ts} · ${l.endpoint}${l.source ? ` (${l.source})` : ""} · HTTP ${l.http_status ?? "—"} · ${l.source_ip ?? "?"}${l.error_message ? ` · ERR: ${l.error_message}` : ""}`,
      );
      // Show short snippet of body for reply events
      if (l.endpoint === "reply" && l.request_body) {
        const body = l.request_body as string;
        // Try to extract from + subject from JSON
        try {
          const j = JSON.parse(body);
          const from =
            j.from?.email ?? j.from ?? j.sender ?? j.envelope?.from ?? "—";
          const subj = j.subject ?? j.headers?.subject ?? "—";
          console.log(`        ↳ from: ${from} | subject: ${String(subj).slice(0, 80)}`);
        } catch {
          console.log(`        ↳ body[:120]: ${body.slice(0, 120)}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
