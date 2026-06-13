import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FINAL_STATUSES = new Set(["rezolvat", "respins"]);
const DAY_MS = 24 * 60 * 60 * 1000;

console.log("=== DETAILED CASE ANALYSIS ===\n");

// AVP Eligible sesizări
const { data: avpCases } = await admin
  .from("sesizari")
  .select("id, code, titlu, status, created_at, official_response_at, sent_at, author_email")
  .gte("created_at", new Date(Date.now() - 45 * DAY_MS).toISOString())
  .not("official_response_at", "is", null);

console.log(`\n=== SESIZĂRI CU RĂSPUNS OFICIAL (official_response_at nu e null) ===`);
const respCases = (avpCases ?? []).filter(s => s.official_response_at);
console.log(`Count: ${respCases.length}`);
for (const s of respCases.slice(0, 10)) {
  const createdMs = new Date(s.created_at).getTime();
  const respondedMs = new Date(s.official_response_at).getTime();
  const responseTime = Math.floor((respondedMs - createdMs) / DAY_MS);
  console.log(`  [${s.code}] ${s.status} | Răspuns în ${responseTime}z | ${new Date(s.official_response_at).toISOString().split('T')[0]}`);
}

// Analyze timeline for AVP eligible cases
const avpEligible = ["00010", "00005", "00004", "00002", "00001"];
console.log(`\n=== TIMELINE EVENTS FOR AVP ELIGIBLE CASES ===`);

for (const code of avpEligible) {
  const { data: case_ } = await admin
    .from("sesizari")
    .select("id, code, created_at, status, official_response_at")
    .eq("code", code)
    .single();

  if (!case_) continue;

  const { data: timeline } = await admin
    .from("sesizare_timeline")
    .select("event_type, created_at, description")
    .eq("sesizare_id", case_.id)
    .order("created_at", { ascending: true });

  console.log(`\n[${code}] Created: ${case_.created_at.split('T')[0]} | Status: ${case_.status}`);
  console.log(`   Official Response: ${case_.official_response_at ? case_.official_response_at.split('T')[0] : '(none)'}`);
  
  for (const evt of timeline ?? []) {
    const days = Math.floor((new Date(evt.created_at).getTime() - new Date(case_.created_at).getTime()) / DAY_MS);
    console.log(`   +${days}d: ${evt.event_type.padEnd(20)} | ${evt.description || '(no desc)'}`);
  }

  // Fetch replies
  const { data: replies } = await admin
    .from("sesizare_replies")
    .select("created_at, from_authority, subject")
    .eq("sesizare_id", case_.id)
    .order("created_at", { ascending: true });

  if ((replies ?? []).length > 0) {
    console.log(`   Replies (${replies.length}):`);
    for (const r of replies) {
      const days = Math.floor((new Date(r.created_at).getTime() - new Date(case_.created_at).getTime()) / DAY_MS);
      console.log(`     +${days}d: ${r.from_authority ? 'FROM_AUTHORITY' : 'from_user'} | ${r.subject || '(no subject)'}`);
    }
  }
}

// Analyze "should be ignorat" cases
console.log(`\n=== SESIZĂRI CARE AR TREBUI IGNORAT (>60d no reply) ===`);
const ignoreTargets = ["00003", "00002", "00001"];

for (const code of ignoreTargets) {
  const { data: case_ } = await admin
    .from("sesizari")
    .select("id, code, created_at, status, official_response_at")
    .eq("code", code)
    .single();

  if (!case_) continue;

  const { data: replies } = await admin
    .from("sesizare_replies")
    .select("created_at, from_authority")
    .eq("sesizare_id", case_.id);

  const createdMs = new Date(case_.created_at).getTime();
  const daysSince = Math.floor((Date.now() - createdMs) / DAY_MS);
  const hasReplies = (replies ?? []).length > 0;

  console.log(`\n[${code}] Status: ${case_.status} | Days: ${daysSince} | Replies: ${hasReplies ? replies.length : 0}`);
  if (case_.official_response_at) {
    console.log(`   !! HAS official_response_at: ${case_.official_response_at.split('T')[0]}`);
  }
}

// Status "trimis" analysis
console.log(`\n=== SESIZĂRI STATUS=TRIMIS (blocate) ===`);
const { data: trimisCases } = await admin
  .from("sesizari")
  .select("id, code, created_at, sent_at")
  .eq("status", "trimis");

console.log(`Total: ${trimisCases?.length ?? 0}`);
for (const s of trimisCases ?? []) {
  const { data: timeline } = await admin
    .from("sesizare_timeline")
    .select("event_type")
    .eq("sesizare_id", s.id)
    .order("created_at", { ascending: true });

  const events = (timeline ?? []).map(t => t.event_type).join(" → ");
  const daysSince = Math.floor((Date.now() - new Date(s.created_at).getTime()) / DAY_MS);
  console.log(`  [${s.code}] Days: ${daysSince} | Events: ${events || '(only depusa)'}`);
}

// Co-signature count
console.log(`\n=== CO-SIGNATURE COUNT (by status) ===`);
const { data: allSez } = await admin
  .from("sesizari")
  .select("id, code, status");

for (const s of allSez ?? []) {
  const { count: coSigCount } = await admin
    .from("sesizare_cosignatures")
    .select("*", { count: "exact", head: 0 })
    .eq("sesizare_id", s.id);

  if ((coSigCount ?? 0) > 0) {
    console.log(`  [${s.code}] ${s.status.padEnd(20)} | Co-sigs: ${coSigCount}`);
  }
}

console.log(`\n=== END ===`);
