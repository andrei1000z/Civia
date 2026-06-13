import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NOW = new Date();
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

console.log(`\n=== WORKFLOW GAP ANALYSIS ===\nAudit date: ${NOW.toISOString()}\n`);

// Get all sesizari with events
const { data: sesizari } = await admin
  .from("sesizari")
  .select(`id, code, titlu, status, created_at, official_response_at`)
  .order("created_at", { ascending: false });

// Get timeline events
const { data: events } = await admin
  .from("sesizare_timeline")
  .select(`sesizare_id, event_type, description, created_at`)
  .order("created_at", { ascending: false });

const eventsBySession = {};
(events || []).forEach((e) => {
  if (!eventsBySession[e.sesizare_id]) {
    eventsBySession[e.sesizare_id] = [];
  }
  eventsBySession[e.sesizare_id].push(e);
});

const findings = {
  missingTrimisEvent: [],
  missingInregistrataEvent: [],
  statusWithoutEvent: [],
  prematureEscalation: [],
  inregistrataWithoutResponse: [],
};

sesizari.forEach((s) => {
  const events_for_session = eventsBySession[s.id] || [];
  const eventTypes = new Set(events_for_session.map((e) => e.event_type));

  // Gap 1: Status "trimis" but no "trimis" or "trimis_via_civia" event
  if ((s.status === "trimis" || s.status === "inregistrata" || s.status === "rezolvat") &&
      !eventTypes.has("trimis") && !eventTypes.has("trimis_via_civia")) {
    findings.missingTrimisEvent.push({
      code: s.code,
      status: s.status,
      events: Array.from(eventTypes),
      title: s.titlu,
    });
  }

  // Gap 2: Status "inregistrata" but no corresponding event
  if (s.status === "inregistrata" && !eventTypes.has("inregistrata")) {
    findings.missingInregistrataEvent.push({
      code: s.code,
      events: Array.from(eventTypes),
      title: s.titlu,
    });
  }

  // Gap 3: Status has no matching timeline event
  const statusToEventMap = {
    trimis: ["trimis", "trimis_via_civia"],
    inregistrata: ["inregistrata"],
    redirectionata: ["redirectionata", "rutata"],
    "in-lucru": ["in-lucru", "in_teren"],
    "actiune-autoritate": ["actiune-autoritate"],
    interventie: ["interventie"],
    amanata: ["amanata"],
    rezolvat: ["rezolvat"],
    respins: ["respins"],
    ignorat: ["ignorat"],
  };

  const expectedEvents = statusToEventMap[s.status] || [];
  const hasMatchingEvent = expectedEvents.some((e) => eventTypes.has(e));

  if (!hasMatchingEvent && s.status !== "nou") {
    findings.statusWithoutEvent.push({
      code: s.code,
      status: s.status,
      expectedEvents,
      actualEvents: Array.from(eventTypes),
      title: s.titlu,
    });
  }

  // Gap 4: Status "inregistrata" 30+ days without any progress event
  if (
    s.status === "inregistrata" &&
    new Date(s.created_at) < THIRTY_DAYS_AGO &&
    !s.official_response_at
  ) {
    const daysSinceFiled = Math.floor(
      (NOW.getTime() - new Date(s.created_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    const progressEvents = events_for_session.filter(
      (e) =>
        e.event_type === "in-lucru" ||
        e.event_type === "in_teren" ||
        e.event_type === "actiune-autoritate" ||
        e.event_type === "interventie" ||
        e.event_type === "rezolvat"
    );
    if (progressEvents.length === 0) {
      findings.inregistrataWithoutResponse.push({
        code: s.code,
        daysSinceFiled,
        title: s.titlu,
        eventCount: events_for_session.length,
      });
    }
  }

  // Gap 5: "inregistrata" for 60+ days with no response should be marked "ignorat"
  if (s.status === "inregistrata") {
    const daysSinceFiled = Math.floor(
      (NOW.getTime() - new Date(s.created_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceFiled >= 60 && !s.official_response_at) {
      findings.prematureEscalation.push({
        code: s.code,
        daysSinceFiled,
        status: s.status,
        shouldBe: "ignorat",
        title: s.titlu,
        reason: `${daysSinceFiled} days without response - should auto-escalate`,
      });
    }
  }
});

console.log(`=== MISSING TRIMIS/SEND EVENT ===`);
if (findings.missingTrimisEvent.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${findings.missingTrimisEvent.length}`);
  findings.missingTrimisEvent.slice(0, 5).forEach((s) => {
    console.log(`    [${s.code}] status=${s.status}, events=[${s.events.join(", ")}]`);
  });
}

console.log(`\n=== MISSING INREGISTRATA EVENT ===`);
if (findings.missingInregistrataEvent.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${findings.missingInregistrataEvent.length}`);
  findings.missingInregistrataEvent.slice(0, 5).forEach((s) => {
    console.log(`    [${s.code}] events=[${s.events.join(", ")}]`);
  });
}

console.log(`\n=== STATUS WITHOUT MATCHING EVENT ===`);
if (findings.statusWithoutEvent.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${findings.statusWithoutEvent.length}`);
  findings.statusWithoutEvent.slice(0, 5).forEach((s) => {
    console.log(`    [${s.code}] status=${s.status}, missing=[${s.expectedEvents.join(", ")}], has=[${s.actualEvents.join(", ")}]`);
  });
}

console.log(`\n=== INREGISTRATA 30+ DAYS WITHOUT RESPONSE ===`);
if (findings.inregistrataWithoutResponse.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${findings.inregistrataWithoutResponse.length}`);
  findings.inregistrataWithoutResponse.slice(0, 5).forEach((s) => {
    console.log(`    [${s.code}] ${s.daysSinceFiled}d old, ${s.eventCount} events total`);
  });
}

console.log(`\n=== SHOULD BE AUTO-ESCALATED TO IGNORAT (60+ DAYS) ===`);
if (findings.prematureEscalation.length === 0) {
  console.log("  None found ✓");
} else {
  console.log(`  Found: ${findings.prematureEscalation.length}`);
  findings.prematureEscalation.slice(0, 10).forEach((s) => {
    console.log(`    [${s.code}] ${s.daysSinceFiled}d - ${s.reason}`);
  });
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total gaps:`);
console.log(`  - Missing trimis event: ${findings.missingTrimisEvent.length}`);
console.log(`  - Missing inregistrata event: ${findings.missingInregistrataEvent.length}`);
console.log(`  - Status without event: ${findings.statusWithoutEvent.length}`);
console.log(`  - Inregistrata 30+ days no response: ${findings.inregistrataWithoutResponse.length}`);
console.log(`  - Should be marked ignorat: ${findings.prematureEscalation.length}`);

const report = {
  auditDate: NOW.toISOString(),
  findings,
};

console.log("\n=== WORKFLOW GAPS JSON ===");
console.log(JSON.stringify(report, null, 2));

process.exit(0);
