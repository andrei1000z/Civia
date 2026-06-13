import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DAY_MS = 24 * 60 * 60 * 1000;
const AVP_DAYS = 45;
const IGNORE_DAYS = 60;

console.log("=== AUTOMATION OPPORTUNITIES & WORKFLOW GAPS ===\n");

// Fetch all
const { data: all } = await admin
  .from("sesizari")
  .select("id, code, status, created_at, official_response_at, sent_at");

const now = new Date();

// Categories for automation
const opportunities = {
  escalate_avp: [],        // Eligible to escalate to AVP (45+ days, no response)
  auto_mark_ignorat: [],   // Eligible to auto-mark ignorat (60+ days, no reply)
  send_reminder: [],       // 30-45 days, no response (reminder email to authority)
  check_registered: [],    // Status=trimis for >7 days (manual check needed)
  no_status_change: [],    // Inbox reply exists but status not updated
  batch_escalate: [],      // Multiple co-signed, eligible for AVP
};

const { data: timeline } = await admin
  .from("sesizare_timeline")
  .select("sesizare_id, event_type");

const timelineMap = new Map();
for (const t of timeline ?? []) {
  if (!timelineMap.has(t.sesizare_id)) {
    timelineMap.set(t.sesizare_id, new Set());
  }
  timelineMap.get(t.sesizare_id).add(t.event_type);
}

const { data: replies } = await admin
  .from("sesizare_replies")
  .select("sesizare_id, from_authority");

const replyMap = new Map();
for (const r of replies ?? []) {
  if (!replyMap.has(r.sesizare_id)) {
    replyMap.set(r.sesizare_id, []);
  }
  replyMap.get(r.sesizare_id).push(r);
}

for (const s of all ?? []) {
  const createdMs = new Date(s.created_at).getTime();
  const days = Math.floor((now.getTime() - createdMs) / DAY_MS);
  const hasReplies = (replyMap.get(s.id) ?? []).length > 0;
  const hasAuthorityReply = (replyMap.get(s.id) ?? []).some(r => r.from_authority);
  const events = timelineMap.get(s.id) ?? new Set();

  // Op 1: AVP Escalation opportunity
  if (days >= AVP_DAYS && !s.official_response_at && !["rezolvat", "respins"].includes(s.status)) {
    opportunities.escalate_avp.push({
      code: s.code,
      status: s.status,
      days,
      hasReplies,
      hasAuthorityReply,
    });
  }

  // Op 2: Auto-mark ignorat
  if (days >= IGNORE_DAYS && !hasReplies && s.status !== "ignorat" && !["rezolvat", "respins"].includes(s.status)) {
    opportunities.auto_mark_ignorat.push({
      code: s.code,
      status: s.status,
      days,
    });
  }

  // Op 3: Send reminder to authority (30-45 days)
  if (days >= 30 && days < AVP_DAYS && !s.official_response_at && !["rezolvat", "respins"].includes(s.status)) {
    opportunities.send_reminder.push({
      code: s.code,
      status: s.status,
      days,
    });
  }

  // Op 4: Check registered (trimis >7 days)
  if (s.status === "trimis" && days > 7) {
    opportunities.check_registered.push({
      code: s.code,
      days,
      sent_at: s.sent_at,
    });
  }

  // Op 5: Has inbox reply but status not changed
  if (hasAuthorityReply && !events.has("inregistrata") && !events.has("in-lucru")) {
    opportunities.no_status_change.push({
      code: s.code,
      current_status: s.status,
      authority_replies: (replyMap.get(s.id) ?? []).length,
    });
  }
}

// Print opportunities
console.log(`ESCALARE AVP (45+ zile, no response): ${opportunities.escalate_avp.length}`);
for (const op of opportunities.escalate_avp) {
  console.log(`  [${op.code}] ${op.status} | ${op.days}d | Replies: ${op.hasReplies}, Authority: ${op.hasAuthorityReply}`);
}

console.log(`\nAUTO-MARK IGNORAT (60+ zile, no reply): ${opportunities.auto_mark_ignorat.length}`);
for (const op of opportunities.auto_mark_ignorat) {
  console.log(`  [${op.code}] ${op.status} | ${op.days}d`);
}

console.log(`\nREMINDER EMAIL (30-45 zile): ${opportunities.send_reminder.length}`);
for (const op of opportunities.send_reminder.slice(0, 10)) {
  console.log(`  [${op.code}] ${op.status} | ${op.days}d`);
}

console.log(`\nCHECK REGISTERED STATUS (trimis >7d): ${opportunities.check_registered.length}`);
for (const op of opportunities.check_registered) {
  console.log(`  [${op.code}] ${op.days}d`);
}

console.log(`\nAUTHORITY REPLIED BUT STATUS NOT UPDATED: ${opportunities.no_status_change.length}`);
for (const op of opportunities.no_status_change) {
  console.log(`  [${op.code}] Current: ${op.current_status} | Authority replies: ${op.authority_replies}`);
}

console.log(`\n=== AUTOMATION STRATEGY ===`);
console.log(`1. DAILY CRON (/api/sesizari/auto-status):`);
console.log(`   - Mark as IGNORAT: ${opportunities.auto_mark_ignorat.length} sesizări (>60d no reply)`);
console.log(`   - Mark as INREGISTRATA: auto-parse "inregistrare #" from authority email`);
console.log(`   - Status escalation detection: check co-semnături + timeline`);

console.log(`\n2. ESCALATION ENDPOINT (/api/sesizari/escalate-avp):`);
console.log(`   - Eligible cases: ${opportunities.escalate_avp.length} (45+ days)`);
console.log(`   - Batch submit to AVP (Avocatul Poporului)`);
console.log(`   - Pre-fill: complaint text + timeline evidence`);

console.log(`\n3. REMINDER SYSTEM (email_reminders):`);
console.log(`   - Send to authority: ${opportunities.send_reminder.length} cases (30-45d window)`);
console.log(`   - Message: "OG 27/2002 reminder: 30-day deadline approaching"`);
console.log(`   - Template: /api/sesizari/reminders`);

console.log(`\n4. MANUAL REVIEW NEEDED:`);
console.log(`   - Check inbox replies: ${opportunities.no_status_change.length} (authority replied, status not auto-updated)`);
console.log(`   - Trimis blocking: ${opportunities.check_registered.length} (stuck in sending state)`);

console.log(`\n=== DETECTED GAPS ===`);
const gaps = [];
if (opportunities.no_status_change.length > 0) {
  gaps.push(`Authority replies are NOT auto-parsed to update status (OCR/AI missing?)`);
}
if (opportunities.check_registered.length > 0) {
  gaps.push(`Trimis state has no auto-progression (need to detect inregistrare confirmation)`);
}
if (opportunities.auto_mark_ignorat.length > 0) {
  gaps.push(`Auto-mark ignorat not running correctly (cron failure or filtering issue)`);
}
console.log(gaps.map(g => `• ${g}`).join('\n'));

console.log(`\n=== END ===`);
