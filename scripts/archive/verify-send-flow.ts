/**
 * Audit complet send flow pentru 00044 + 00046:
 *  - Verifică resend_message_id (Resend ID-ul de delivery)
 *  - Verifică sent_to_emails (cui s-a trimis)
 *  - Verifică sent_at + sent_via_civia
 *  - Verifică formal_text (textul efectiv trimis în email)
 *  - Verifică reminders programate
 *  - Verifică dacă există Sentry breadcrumbs / errors
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface Sesizare {
  id: string;
  code: string;
  titlu: string;
  status: string;
  sent_via_civia: boolean | null;
  sent_at: string | null;
  sent_to_emails: string[] | null;
  resend_message_id: string | null;
  author_name: string;
  author_address?: string | null;
  author_email: string | null;
  formal_text: string | null;
  descriere: string;
  locatie: string;
  tip: string;
  created_at: string;
  updated_at: string;
  nr_inregistrare: string | null;
}

async function main() {
  const codes = ["00044", "00046"];
  for (const code of codes) {
    const { data, error } = await sa
      .from("sesizari")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error || !data) {
      console.log(`\n❌ ${code}: not found`);
      continue;
    }
    const s = data as Sesizare;
    console.log(`\n${"═".repeat(80)}`);
    console.log(`🎫 SESIZARE ${s.code} — ${s.titlu}`);
    console.log(`${"═".repeat(80)}`);
    console.log(`📅 Creată: ${s.created_at}`);
    console.log(`📅 Trimisă: ${s.sent_at ?? "(nu)"}`);
    console.log(`📌 Status: ${s.status}`);
    console.log(`📋 Nr înregistrare: ${s.nr_inregistrare ?? "(nu)"}`);
    console.log(`\n👤 Identitate cetățean:`);
    console.log(`   Nume: ${s.author_name}`);
    console.log(`   Adresă: ${s.author_address ?? "❌ LIPSĂ"}`);
    console.log(`   Email: ${s.author_email}`);
    console.log(`\n📤 Send via Civia:`);
    console.log(`   sent_via_civia: ${s.sent_via_civia}`);
    console.log(`   resend_message_id: ${s.resend_message_id ?? "❌ LIPSĂ"}`);
    console.log(`   Destinatari (${(s.sent_to_emails ?? []).length}):`);
    for (const to of s.sent_to_emails ?? []) {
      console.log(`     - ${to}`);
    }
    console.log(`\n📝 Locație: ${s.locatie}`);
    console.log(`📂 Tip: ${s.tip}`);
    console.log(`\n📄 Formal text (primele 600 caractere):`);
    console.log("─".repeat(80));
    console.log((s.formal_text ?? "(LIPSĂ - email gol!)").slice(0, 600));
    if (s.formal_text && s.formal_text.length > 600) {
      console.log(`... [+${s.formal_text.length - 600} chars]`);
    }
    console.log("─".repeat(80));

    // Verificări critice
    const checks: { name: string; ok: boolean; msg?: string }[] = [
      { name: "sent_via_civia=true", ok: s.sent_via_civia === true },
      { name: "resend_message_id prezent", ok: !!s.resend_message_id },
      { name: "sent_to_emails are >=1 dest", ok: (s.sent_to_emails ?? []).length >= 1 },
      { name: "formal_text >= 200 chars", ok: (s.formal_text?.length ?? 0) >= 200 },
      { name: "author_name >= 2 chars", ok: (s.author_name ?? "").length >= 2 },
      { name: "author_address >= 3 chars", ok: (s.author_address ?? "").length >= 3 },
    ];
    console.log(`\n✅ Verificări critice:`);
    let allOk = true;
    for (const c of checks) {
      const icon = c.ok ? "✓" : "❌";
      console.log(`   ${icon} ${c.name}`);
      if (!c.ok) allOk = false;
    }
    console.log(`\n${allOk ? "🎉 TOT OK" : "⚠️  PROBLEME DETECTATE"}`);

    // Check reminders
    const { data: reminders, count: rc } = await sa
      .from("sesizare_reminders")
      .select("*", { count: "exact" })
      .eq("sesizare_id", s.id);
    console.log(`\n⏰ Reminders programate: ${rc ?? 0}`);
    for (const r of (reminders ?? []) as Array<{ kind: string; scheduled_for: string; sent_at: string | null }>) {
      console.log(`   ${r.kind} | scheduled ${r.scheduled_for} | sent: ${r.sent_at ?? "NO"}`);
    }

    // Check timeline
    const { data: tl, count: tlc } = await sa
      .from("sesizare_timeline")
      .select("event_type, description, created_at", { count: "exact" })
      .eq("sesizare_id", s.id)
      .order("created_at", { ascending: true });
    console.log(`\n📚 Timeline events: ${tlc ?? 0}`);
    for (const t of (tl ?? []) as Array<{ event_type: string; description: string; created_at: string }>) {
      console.log(`   ${t.created_at} | ${t.event_type} | ${t.description?.slice(0, 80) ?? ""}`);
    }
  }
}
main();
