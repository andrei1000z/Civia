import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const AVP_ESCALATION_DAYS = 45;
const IGNORE_CUTOFF_DAYS = 60;
const FINAL_STATUSES = new Set(["rezolvat", "respins"]);
const DAY_MS = 24 * 60 * 60 * 1000;

console.log("=== AUDIT: Status Flow & Escalation Eligibility ===\n");

// Fetch sesizări
const { data: sesizari, error: errSez } = await admin
  .from("sesizari")
  .select("id, code, titlu, status, created_at, sent_at, official_response_at, author_email");

if (errSez) {
  console.error("ERROR fetching sesizari:", errSez);
  process.exit(1);
}

console.log(`Total sesizări în DB: ${sesizari?.length ?? 0}\n`);

// Fetch timeline events
const { data: timelineEvents } = await admin
  .from("sesizare_timeline")
  .select("sesizare_id, event_type, created_at, description")
  .order("created_at", { ascending: true });

const timelineMap = new Map();
for (const evt of timelineEvents ?? []) {
  if (!timelineMap.has(evt.sesizare_id)) {
    timelineMap.set(evt.sesizare_id, []);
  }
  timelineMap.get(evt.sesizare_id).push(evt);
}

// Fetch replies
const { data: replies } = await admin
  .from("sesizare_replies")
  .select("sesizare_id, created_at, from_authority");

const replyMap = new Map();
for (const r of replies ?? []) {
  if (!replyMap.has(r.sesizare_id)) {
    replyMap.set(r.sesizare_id, []);
  }
  replyMap.get(r.sesizare_id).push(r);
}

// Analysis categories
const findings = {
  overdue: [],
  avp_eligible: [],
  should_be_ignorat: [],
  sent_never_registered: [],
  new_never_sent: [],
  resolved_no_response: [],
  timeline_gaps: [],
  replied_but_in_progress: [],
};

const now = new Date();

for (const sez of sesizari ?? []) {
  const createdMs = new Date(sez.created_at).getTime();
  const daysSinceFiled = Math.floor((now.getTime() - createdMs) / DAY_MS);
  const daysOverdue = daysSinceFiled - 30;
  
  const timeline = timelineMap.get(sez.id) ?? [];
  const sesizariReplies = replyMap.get(sez.id) ?? [];
  const hasReplies = sesizariReplies.length > 0;
  
  // Categoria 1: OVERDUE
  if (daysOverdue > 0 && !sez.official_response_at && !FINAL_STATUSES.has(sez.status)) {
    findings.overdue.push({
      code: sez.code,
      status: sez.status,
      daysSinceFiled,
      daysOverdue,
    });
  }

  // Categoria 2: AVP ELIGIBLE
  if (daysSinceFiled >= AVP_ESCALATION_DAYS && !sez.official_response_at && !FINAL_STATUSES.has(sez.status)) {
    findings.avp_eligible.push({
      code: sez.code,
      status: sez.status,
      daysSinceFiled,
    });
  }

  // Categoria 3: SHOULD BE IGNORAT
  if (daysSinceFiled >= IGNORE_CUTOFF_DAYS && !hasReplies && sez.status !== "ignorat" && !FINAL_STATUSES.has(sez.status)) {
    findings.should_be_ignorat.push({
      code: sez.code,
      status: sez.status,
      daysSinceFiled,
    });
  }

  // Categoria 4: SENT BUT NEVER REGISTERED
  if (sez.status === "trimis") {
    const hasRegisteredEvent = timeline.some(e => ["inregistrata", "in-lucru", "redirectionata", "actiune-autoritate", "amanata", "rezolvat", "respins", "ignorat"].includes(e.event_type));
    if (!hasRegisteredEvent) {
      findings.sent_never_registered.push({
        code: sez.code,
        daysSinceFiled,
      });
    }
  }

  // Categoria 5: NEW NEVER SENT
  if (sez.status === "nou" && daysSinceFiled > 30) {
    findings.new_never_sent.push({
      code: sez.code,
      daysSinceFiled,
    });
  }

  // Categoria 6: RESOLVED/RESPINS BUT NO official_response_at
  if (FINAL_STATUSES.has(sez.status) && !sez.official_response_at) {
    findings.resolved_no_response.push({
      code: sez.code,
      status: sez.status,
    });
  }

  // Categoria 7: TIMELINE GAPS
  if (sez.status !== "nou" && !timeline.some(e => e.event_type === sez.status)) {
    findings.timeline_gaps.push({
      code: sez.code,
      status: sez.status,
      timeline_count: timeline.length,
    });
  }

  // Categoria 8: REPLIED BUT STATUS SAYS IN-PROGRESS
  if (hasReplies && ["in-lucru", "amanata", "redirectionata"].includes(sez.status)) {
    findings.replied_but_in_progress.push({
      code: sez.code,
      status: sez.status,
      reply_count: sesizariReplies.length,
    });
  }
}

// Print findings
console.log(`1. OVERDUE (>30 zile fără răspuns): ${findings.overdue.length}`);
for (const f of findings.overdue.slice(0, 5)) {
  console.log(`   [${f.code}] ${f.status} | Days: ${f.daysSinceFiled} | Overdue: ${f.daysOverdue}`);
}

console.log(`\n2. AVP ELIGIBLE (>45 zile): ${findings.avp_eligible.length}`);
for (const f of findings.avp_eligible.slice(0, 10)) {
  console.log(`   [${f.code}] ${f.status} | Days: ${f.daysSinceFiled}`);
}

console.log(`\n3. SHOULD BE IGNORAT (>60 zile): ${findings.should_be_ignorat.length}`);
for (const f of findings.should_be_ignorat) {
  console.log(`   [${f.code}] ${f.status} | Days: ${f.daysSinceFiled}`);
}

console.log(`\n4. SENT BUT NEVER REGISTERED: ${findings.sent_never_registered.length}`);
for (const f of findings.sent_never_registered.slice(0, 10)) {
  console.log(`   [${f.code}] Days: ${f.daysSinceFiled}`);
}

console.log(`\n5. NEW NEVER SENT (>30d): ${findings.new_never_sent.length}`);
for (const f of findings.new_never_sent) {
  console.log(`   [${f.code}] Days: ${f.daysSinceFiled}`);
}

console.log(`\n6. RESOLVED/RESPINS NO official_response_at: ${findings.resolved_no_response.length}`);
for (const f of findings.resolved_no_response.slice(0, 5)) {
  console.log(`   [${f.code}] ${f.status}`);
}

console.log(`\n7. TIMELINE GAPS (status ≠ event): ${findings.timeline_gaps.length}`);
for (const f of findings.timeline_gaps.slice(0, 10)) {
  console.log(`   [${f.code}] ${f.status} | Timeline: ${f.timeline_count}`);
}

console.log(`\n8. REPLIED BUT IN-PROGRESS: ${findings.replied_but_in_progress.length}`);
for (const f of findings.replied_but_in_progress.slice(0, 5)) {
  console.log(`   [${f.code}] ${f.status} | Replies: ${f.reply_count}`);
}

// Status distribution
const statusDist = new Map();
for (const sez of sesizari ?? []) {
  const k = sez.status;
  if (!statusDist.has(k)) {
    statusDist.set(k, { count: 0, overdue: 0, avp_eligible: 0 });
  }
  const rec = statusDist.get(k);
  rec.count += 1;
  if (findings.overdue.some(f => f.code === sez.code)) rec.overdue += 1;
  if (findings.avp_eligible.some(f => f.code === sez.code)) rec.avp_eligible += 1;
}

console.log(`\n=== STATUS DISTRIBUTION ===`);
const statuses = ["nou", "trimis", "inregistrata", "redirectionata", "in-lucru", "actiune-autoritate", "interventie", "amanata", "rezolvat", "respins", "ignorat"];
for (const s of statuses) {
  const rec = statusDist.get(s);
  if (rec) {
    console.log(`  ${s.padEnd(20)} count=${rec.count.toString().padStart(3)} | overdue=${rec.overdue.toString().padStart(3)} | avp_eligible=${rec.avp_eligible.toString().padStart(3)}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total sesizări: ${sesizari?.length ?? 0}`);
console.log(`Overdue (>30d): ${findings.overdue.length}`);
console.log(`AVP Eligible (>45d): ${findings.avp_eligible.length}`);
console.log(`Should be IGNORAT (>60d): ${findings.should_be_ignorat.length}`);
console.log(`Sent→never_registered: ${findings.sent_never_registered.length}`);
console.log(`New→never_sent (>30d): ${findings.new_never_sent.length}`);
console.log(`Final→no_response: ${findings.resolved_no_response.length}`);
console.log(`Timeline gaps: ${findings.timeline_gaps.length}`);
console.log(`Positive (replied but in-progress): ${findings.replied_but_in_progress.length}`);
