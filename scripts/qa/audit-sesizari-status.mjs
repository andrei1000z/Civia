import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NOW = new Date();
const THREE_DAYS_AGO = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
const FORTY_FIVE_DAYS_AGO = new Date(NOW.getTime() - 45 * 24 * 60 * 60 * 1000);
const SIXTY_DAYS_AGO = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000);

console.log(`\n=== AUDIT SESIZARI CIVIA ===\nAudit date: ${NOW.toISOString()}\n`);

// Get all sesizari
const { data: sesizari, error } = await admin
  .from("sesizari")
  .select(
    `id, code, titlu, status, created_at, updated_at, official_response_at, 
     user_id`
  )
  .order("created_at", { ascending: false });

if (error) {
  console.error("Error fetching sesizari:", error);
  process.exit(1);
}

console.log(`Total sesizari: ${sesizari.length}\n`);

// Status distribution
const statusDist = {};
sesizari.forEach((s) => {
  statusDist[s.status] = (statusDist[s.status] || 0) + 1;
});

console.log("=== STATUS DISTRIBUTION ===");
Object.entries(statusDist)
  .sort((a, b) => b[1] - a[1])
  .forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

// BLOCKING & STALE ANALYSIS
const blockedAndStale = [];
const oldNoStatus = [];
const escalationEligible = [];
const ignoredWithResponse = [];

sesizari.forEach((s) => {
  const createdAt = new Date(s.created_at);
  const daysSinceFiled = Math.floor(
    (NOW.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Rule 1: "nou" or "trimis" older than 3 days
  if ((s.status === "nou" || s.status === "trimis") && createdAt < THREE_DAYS_AGO) {
    blockedAndStale.push({
      code: s.code,
      status: s.status,
      title: s.titlu,
      daysSinceFiled,
      created_at: s.created_at,
      updated_at: s.updated_at,
      reason: `${s.status} for ${daysSinceFiled} days (stale)`,
    });
  }

  // Rule 2: "inregistrata" very old without authority response
  if (
    s.status === "inregistrata" &&
    createdAt < THIRTY_DAYS_AGO &&
    !s.official_response_at
  ) {
    oldNoStatus.push({
      code: s.code,
      status: s.status,
      title: s.titlu,
      daysSinceFiled,
      created_at: s.created_at,
      updated_at: s.updated_at,
      reason: `registered ${daysSinceFiled} days ago, no response`,
    });
  }

  // Rule 3: "trimis" very old without moving forward
  if (
    s.status === "trimis" &&
    createdAt < THIRTY_DAYS_AGO &&
    !s.official_response_at
  ) {
    oldNoStatus.push({
      code: s.code,
      status: s.status,
      title: s.titlu,
      daysSinceFiled,
      created_at: s.created_at,
      updated_at: s.updated_at,
      reason: `sent ${daysSinceFiled} days ago, never registered`,
    });
  }

  // Rule 4: Escalation eligibility (45+ days without response, no official_response_at)
  if (
    daysSinceFiled >= 45 &&
    !s.official_response_at &&
    s.status !== "rezolvat" &&
    s.status !== "respins" &&
    s.status !== "ignorat" &&
    s.status !== "escaladat_avp"
  ) {
    escalationEligible.push({
      code: s.code,
      status: s.status,
      title: s.titlu,
      daysSinceFiled,
      created_at: s.created_at,
      reason: `${daysSinceFiled} days overdue (AVP escalation threshold)`,
    });
  }

  // Rule 5: "ignorat" status with official_response_at (contradiction)
  if (s.status === "ignorat" && s.official_response_at) {
    ignoredWithResponse.push({
      code: s.code,
      status: s.status,
      title: s.titlu,
      daysSinceFiled,
      created_at: s.created_at,
      official_response_at: s.official_response_at,
      reason: `marked as ignored but has response_at: ${s.official_response_at}`,
    });
  }
});

console.log(`\n=== BLOCKED & STALE (nou/trimis >3 days) ===`);
if (blockedAndStale.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${blockedAndStale.length}`);
  blockedAndStale.slice(0, 10).forEach((s) => {
    console.log(
      `    [${s.code}] ${s.status} • ${s.daysSinceFiled}d • "${s.title.substring(0, 50)}..."`
    );
  });
  if (blockedAndStale.length > 10) {
    console.log(`    ... and ${blockedAndStale.length - 10} more`);
  }
}

console.log(`\n=== VERY OLD WITHOUT PROGRESSION (inregistrata/trimis >30 days) ===`);
if (oldNoStatus.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${oldNoStatus.length}`);
  oldNoStatus.slice(0, 10).forEach((s) => {
    console.log(
      `    [${s.code}] ${s.status} • ${s.daysSinceFiled}d • "${s.title.substring(0, 50)}..."`
    );
  });
  if (oldNoStatus.length > 10) {
    console.log(`    ... and ${oldNoStatus.length - 10} more`);
  }
}

console.log(`\n=== AVP ESCALATION ELIGIBLE (45+ days, no response) ===`);
if (escalationEligible.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${escalationEligible.length}`);
  escalationEligible.slice(0, 10).forEach((s) => {
    console.log(
      `    [${s.code}] ${s.status} • ${s.daysSinceFiled}d • "${s.title.substring(0, 40)}..."`
    );
  });
  if (escalationEligible.length > 10) {
    console.log(`    ... and ${escalationEligible.length - 10} more`);
  }
}

console.log(`\n=== DATA ANOMALIES ===`);
if (ignoredWithResponse.length === 0) {
  console.log("  No contradictions found ✓");
} else {
  console.log(`  Found ${ignoredWithResponse.length} anomalies:`);
  ignoredWithResponse.forEach((s) => {
    console.log(`    [${s.code}] ${s.reason}`);
  });
}

// Check for sessions/updated_at mismatch
const staleSessions = sesizari.filter((s) => {
  const updated = new Date(s.updated_at);
  return updated < SIXTY_DAYS_AGO && s.status !== "rezolvat" && s.status !== "respins";
});

console.log(`\n=== ACTIVE SESSIONS UNCHANGED 60+ DAYS ===`);
if (staleSessions.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${staleSessions.length}`);
  staleSessions.slice(0, 10).forEach((s) => {
    const daysSinceUpdate = Math.floor(
      (NOW.getTime() - new Date(s.updated_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    console.log(
      `    [${s.code}] ${s.status} • last update: ${daysSinceUpdate}d ago • "${s.titlu.substring(0, 40)}..."`
    );
  });
  if (staleSessions.length > 10) {
    console.log(`    ... and ${staleSessions.length - 10} more`);
  }
}

// Summary
console.log(`\n=== SUMMARY ===`);
console.log(`Total issues found:`);
console.log(`  - Blocked (nou/trimis >3d): ${blockedAndStale.length}`);
console.log(`  - Very old no progression: ${oldNoStatus.length}`);
console.log(`  - AVP escalation eligible: ${escalationEligible.length}`);
console.log(`  - Data anomalies: ${ignoredWithResponse.length}`);
console.log(`  - Stale sessions (60+ days unchanged): ${staleSessions.length}`);
console.log(`\nTotal problematic: ${blockedAndStale.length + oldNoStatus.length + escalationEligible.length + ignoredWithResponse.length + staleSessions.length}`);

// Export JSON for further analysis
const report = {
  auditDate: NOW.toISOString(),
  totalSesizari: sesizari.length,
  statusDistribution: statusDist,
  issues: {
    blockedAndStale,
    oldNoProgression: oldNoStatus,
    avpEscalationEligible: escalationEligible,
    dataAnomalies: ignoredWithResponse,
    staleSessions,
  },
};

console.log("\n=== FULL JSON REPORT ===");
console.log(JSON.stringify(report, null, 2));

process.exit(0);
