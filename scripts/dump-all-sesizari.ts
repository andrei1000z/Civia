/**
 * Dumpează TOATE sesizările din DB cu tot ce avem despre fiecare:
 * meta (code, tip, status, locație, sector, lat/lng, dată)
 * identitate (author_name, author_address, author_email, user_id, profile)
 * conținut (titlu, descriere, imagini count)
 * email (formal_text complet, sent_via_civia, sent_at, sent_to_emails, resend_message_id)
 * timeline (toate evenimentele)
 * replies (emailuri primite înapoi)
 * engagement (votes count, follows count, signatures count, comments count)
 *
 * One-shot inspection — folosit pentru audit complet.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const LINE = "═".repeat(100);
const SUB = "─".repeat(100);

async function main() {
  const { data: sesizari, error, count } = await sa
    .from("sesizari")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }

  type Row = {
    id: string; code: string; user_id: string | null;
    author_name: string; author_email: string | null; author_address: string | null;
    tip: string; titlu: string; locatie: string; sector: string;
    lat: number; lng: number; descriere: string; formal_text: string | null;
    status: string; imagini: string[] | null; publica: boolean;
    moderation_status: string; resolved_at: string | null;
    resolved_by_author: boolean | null; resolved_photo_url: string | null;
    sent_via_civia: boolean | null; sent_at: string | null;
    sent_to_emails: string[] | null; resend_message_id: string | null;
    created_at: string; updated_at: string;
  };
  const rows = (sesizari ?? []) as Row[];

  console.log(`\n📋 TOTAL SESIZĂRI ÎN DB: ${count ?? 0}\n`);

  // Pre-fetch all related data in 4 batched queries (vs N×4)
  const ids = rows.map((r) => r.id);
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));

  const [profilesRes, timelineRes, repliesRes, votesRes, followsRes, signsRes, commentsRes] = await Promise.all([
    sa.from("profiles").select("id, display_name, address, role").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    sa.from("sesizare_timeline").select("sesizare_id, event_type, description, created_at").in("sesizare_id", ids).order("created_at", { ascending: true }),
    sa.from("sesizare_replies").select("sesizare_id, from_email, from_name, authority_name, subject, ai_status, ai_confidence, ai_summary, ai_nr_inregistrare, received_at, trusted_sender, auto_applied, body_text").in("sesizare_id", ids).order("received_at", { ascending: true }),
    sa.from("sesizare_votes").select("sesizare_id, value").in("sesizare_id", ids),
    sa.from("sesizare_follows").select("sesizare_id").in("sesizare_id", ids),
    sa.from("sesizare_cosigners").select("sesizare_id").in("sesizare_id", ids),
    sa.from("sesizare_comments").select("sesizare_id").in("sesizare_id", ids),
  ]);

  const profMap = new Map<string, { display_name: string | null; address: string | null; role: string | null }>();
  for (const p of (profilesRes.data ?? []) as Array<{ id: string; display_name: string | null; address: string | null; role: string | null }>) {
    profMap.set(p.id, { display_name: p.display_name, address: p.address, role: p.role });
  }

  const timelineMap = new Map<string, Array<{ event_type: string; description: string | null; created_at: string }>>();
  for (const t of (timelineRes.data ?? []) as Array<{ sesizare_id: string; event_type: string; description: string | null; created_at: string }>) {
    if (!timelineMap.has(t.sesizare_id)) timelineMap.set(t.sesizare_id, []);
    timelineMap.get(t.sesizare_id)!.push({ event_type: t.event_type, description: t.description, created_at: t.created_at });
  }

  const repliesMap = new Map<string, Array<{ from_email: string; from_name: string | null; authority_name: string | null; subject: string | null; ai_status: string | null; ai_confidence: number | null; ai_summary: string | null; ai_nr_inregistrare: string | null; received_at: string; trusted_sender: boolean | null; auto_applied: boolean | null; body_text: string | null }>>();
  for (const r of (repliesRes.data ?? []) as Array<{ sesizare_id: string; from_email: string; from_name: string | null; authority_name: string | null; subject: string | null; ai_status: string | null; ai_confidence: number | null; ai_summary: string | null; ai_nr_inregistrare: string | null; received_at: string; trusted_sender: boolean | null; auto_applied: boolean | null; body_text: string | null }>) {
    if (!repliesMap.has(r.sesizare_id)) repliesMap.set(r.sesizare_id, []);
    repliesMap.get(r.sesizare_id)!.push(r);
  }

  const votesMap = new Map<string, { up: number; down: number }>();
  for (const v of (votesRes.data ?? []) as Array<{ sesizare_id: string; value: number }>) {
    const cur = votesMap.get(v.sesizare_id) ?? { up: 0, down: 0 };
    if (v.value > 0) cur.up += 1; else cur.down += 1;
    votesMap.set(v.sesizare_id, cur);
  }

  const followCount = new Map<string, number>();
  for (const f of (followsRes.data ?? []) as Array<{ sesizare_id: string }>) {
    followCount.set(f.sesizare_id, (followCount.get(f.sesizare_id) ?? 0) + 1);
  }

  const signCount = new Map<string, number>();
  for (const s of (signsRes.data ?? []) as Array<{ sesizare_id: string }>) {
    signCount.set(s.sesizare_id, (signCount.get(s.sesizare_id) ?? 0) + 1);
  }

  const commentCount = new Map<string, number>();
  for (const c of (commentsRes.data ?? []) as Array<{ sesizare_id: string }>) {
    commentCount.set(c.sesizare_id, (commentCount.get(c.sesizare_id) ?? 0) + 1);
  }

  // Print each
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const prof = r.user_id ? profMap.get(r.user_id) : null;
    const tl = timelineMap.get(r.id) ?? [];
    const replies = repliesMap.get(r.id) ?? [];
    const votes = votesMap.get(r.id) ?? { up: 0, down: 0 };
    const follows = followCount.get(r.id) ?? 0;
    const signs = signCount.get(r.id) ?? 0;
    const comments = commentCount.get(r.id) ?? 0;

    console.log(LINE);
    console.log(`#${i + 1}  ${r.code}  •  ${r.titlu}`);
    console.log(LINE);
    console.log(`📅 Creat: ${r.created_at}`);
    console.log(`🔄 Actualizat: ${r.updated_at}`);
    if (r.resolved_at) console.log(`✅ Rezolvat: ${r.resolved_at}${r.resolved_by_author ? " (de author)" : ""}`);

    console.log(`\n📍 LOCAȚIE`);
    console.log(`   Adresă: ${r.locatie}`);
    console.log(`   Sector: ${r.sector}`);
    console.log(`   Coord: ${r.lat}, ${r.lng}`);
    console.log(`   Maps: https://www.google.com/maps?q=${r.lat},${r.lng}`);

    console.log(`\n👤 IDENTITATE CETĂȚEAN`);
    console.log(`   Nume (author_name): ${r.author_name}`);
    console.log(`   Email (author_email): ${r.author_email ?? "—"}`);
    console.log(`   Adresă cetățean (author_address): ${r.author_address ?? "— (lipsește)"}`);
    if (prof) {
      console.log(`   Profile.display_name: ${prof.display_name ?? "—"}`);
      console.log(`   Profile.address: ${prof.address ?? "—"}`);
      console.log(`   Profile.role: ${prof.role ?? "user"}`);
    } else if (r.user_id) {
      console.log(`   Profile: ID ${r.user_id} (nu găsit)`);
    } else {
      console.log(`   Profile: — (sesizare anonimă)`);
    }

    console.log(`\n🏷️  CATEGORIE & STATUS`);
    console.log(`   Tip: ${r.tip}`);
    console.log(`   Status: ${r.status}`);
    console.log(`   Publică: ${r.publica ? "DA" : "NU"}`);
    console.log(`   Moderare: ${r.moderation_status}`);

    console.log(`\n📝 CONȚINUT DE LA CETĂȚEAN`);
    console.log(`   Titlu: ${r.titlu}`);
    console.log(`   Descriere:`);
    console.log(`     ${r.descriere.split("\n").join("\n     ")}`);
    console.log(`   Imagini atașate: ${r.imagini?.length ?? 0}`);
    if (r.imagini && r.imagini.length > 0) {
      for (const img of r.imagini.slice(0, 3)) console.log(`     - ${img}`);
      if (r.imagini.length > 3) console.log(`     ... (+${r.imagini.length - 3})`);
    }

    console.log(`\n📧 EMAIL OFICIAL (formal_text — trimis primăriei)`);
    if (r.formal_text) {
      console.log(SUB);
      console.log(r.formal_text);
      console.log(SUB);
      console.log(`   Lungime: ${r.formal_text.length} caractere`);
    } else {
      console.log(`   — (nu există formal_text)`);
    }

    console.log(`\n🚀 TRIMITERE`);
    console.log(`   Sent via Civia: ${r.sent_via_civia ? "✓ DA" : "✗ NU"}`);
    if (r.sent_at) console.log(`   Trimis la: ${r.sent_at}`);
    if (r.sent_to_emails && r.sent_to_emails.length > 0) {
      console.log(`   Destinatari:`);
      for (const em of r.sent_to_emails) console.log(`     - ${em}`);
    }
    if (r.resend_message_id) console.log(`   Resend ID: ${r.resend_message_id}`);

    console.log(`\n📊 ENGAGEMENT`);
    console.log(`   Voturi: 👍 ${votes.up}  •  👎 ${votes.down}  •  Net: ${votes.up - votes.down}`);
    console.log(`   Co-semnări: ${signs}`);
    console.log(`   Follows: ${follows}`);
    console.log(`   Comentarii: ${comments}`);

    if (tl.length > 0) {
      console.log(`\n📜 TIMELINE (${tl.length} evenimente)`);
      for (const t of tl) {
        console.log(`   • [${t.created_at}] ${t.event_type}${t.description ? ` — ${t.description.slice(0, 120)}` : ""}`);
      }
    } else {
      console.log(`\n📜 TIMELINE: (gol)`);
    }

    if (replies.length > 0) {
      console.log(`\n📬 EMAILURI PRIMITE INAPOI (${replies.length})`);
      for (const rep of replies) {
        console.log(`   • [${rep.received_at}] de la ${rep.from_name ? `${rep.from_name} <${rep.from_email}>` : rep.from_email}`);
        if (rep.authority_name) console.log(`     Autoritate: ${rep.authority_name}`);
        console.log(`     Subject: ${rep.subject ?? "(no subject)"}`);
        console.log(`     AI: ${rep.ai_status} (${rep.ai_confidence ?? "?"}%)${rep.auto_applied ? " → auto-aplicat" : ""}`);
        if (rep.ai_summary) console.log(`     Summary: ${rep.ai_summary}`);
        if (rep.ai_nr_inregistrare) console.log(`     Nr înreg: ${rep.ai_nr_inregistrare}`);
        if (rep.body_text) {
          const preview = rep.body_text.slice(0, 200).replace(/\n+/g, " ").trim();
          console.log(`     Body: ${preview}${rep.body_text.length > 200 ? "..." : ""}`);
        }
      }
    } else {
      console.log(`\n📬 EMAILURI PRIMITE: (niciunul)`);
    }

    console.log(`\n🔗 Link public: https://civia.ro/sesizari/${r.code}`);
    console.log("");
  }

  // Aggregate stats
  console.log(LINE);
  console.log("📊 SUMAR AGREGAT");
  console.log(LINE);
  const byTip = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const bySector = new Map<string, number>();
  let totalSent = 0;
  let totalPublica = 0;
  let totalWithFormalText = 0;
  let totalWithImages = 0;
  let totalWithReplies = 0;
  for (const r of rows) {
    byTip.set(r.tip, (byTip.get(r.tip) ?? 0) + 1);
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + 1);
    if (r.sent_via_civia) totalSent += 1;
    if (r.publica) totalPublica += 1;
    if (r.formal_text) totalWithFormalText += 1;
    if (r.imagini && r.imagini.length > 0) totalWithImages += 1;
    if ((repliesMap.get(r.id) ?? []).length > 0) totalWithReplies += 1;
  }

  console.log(`\n   Total: ${rows.length}`);
  console.log(`   Publice: ${totalPublica}/${rows.length}`);
  console.log(`   Trimise via Civia: ${totalSent}/${rows.length}`);
  console.log(`   Cu formal_text: ${totalWithFormalText}/${rows.length}`);
  console.log(`   Cu poze: ${totalWithImages}/${rows.length}`);
  console.log(`   Cu reply primit: ${totalWithReplies}/${rows.length}`);

  console.log(`\n   Pe tip:`);
  for (const [k, v] of [...byTip.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k}: ${v}`);
  }
  console.log(`\n   Pe status:`);
  for (const [k, v] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k}: ${v}`);
  }
  console.log(`\n   Pe sector:`);
  for (const [k, v] of [...bySector.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${k}: ${v}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
