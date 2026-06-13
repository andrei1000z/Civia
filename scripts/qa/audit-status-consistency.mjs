import { config } from "dotenv";
import { existsSync } from "fs";

// Load environment
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Constants
const SENT_STATUS = "trimis";
const REGISTERED_STATUS = "inregistrata";
const FINAL_STATUSES = new Set(["rezolvat", "respins", "ignorat"]);
const SENT_VIA_CIVIA_THRESHOLD_DAYS = 45;
const AVP_ESCALATION_DAYS = 45;
const RESPONSE_DEADLINE_DAYS = 30;

/**
 * Anomalies found:
 * 1. Status "trimis"/"inregistrata" but sent_at is NULL
 * 2. Advanced status but sent_via_civia = false
 * 3. official_response_at set but status still "trimis"/"inregistrata"
 * 4. sent_at is old (>45 days) without official_response_at (should be escalated to AVP but not marked "ignorat")
 * 5. Status "ignorat" but official_response_at is set (contradictory)
 * 6. sent_at very old (>90 days) without official_response_at and status not "ignorat"
 * 7. Multiple sent_at dates in timeline events but metadata inconsistent
 */

async function auditDatabase() {
  console.log("🔍 Starting Civia Database Consistency Audit...\n");

  const anomalies = [];
  const findings = [];

  // Fetch all sesizari with key fields
  const { data: sesizari, error: sesizariError } = await supabase
    .from("sesizari")
    .select(`
      id,
      code,
      status,
      created_at,
      sent_via_civia,
      sent_at,
      sent_to_emails,
      official_response_at,
      resolved_at
    `)
    .eq("moderation_status", "approved");

  if (sesizariError) {
    console.error("❌ Error fetching sesizari:", sesizariError);
    process.exit(1);
  }

  console.log(`📊 Total sesizari (approved): ${sesizari.length}`);

  // Fetch timeline events for sent/response tracking
  const { data: events, error: eventsError } = await supabase
    .from("sesizare_timeline")
    .select("sesizare_id, event_type, created_at, description")
    .in("event_type", ["trimis", "trimis_via_civia", "inregistrata", "depusa"]);

  if (eventsError) {
    console.error("❌ Error fetching events:", eventsError);
    process.exit(1);
  }

  // Build event map
  const eventMap = new Map();
  for (const event of events) {
    if (!eventMap.has(event.sesizare_id)) {
      eventMap.set(event.sesizare_id, []);
    }
    eventMap.get(event.sesizare_id).push(event);
  }

  // Process each sesizare
  for (const s of sesizari) {
    const createdDate = new Date(s.created_at);
    const nowDate = new Date();
    const daysSinceFiled = Math.floor((nowDate - createdDate) / (24 * 60 * 60 * 1000));

    // ANOMALY 1: Status "trimis"/"inregistrata" but sent_at is NULL
    if ([SENT_STATUS, REGISTERED_STATUS].includes(s.status) && !s.sent_at) {
      anomalies.push({
        code: s.code,
        problem: `Status "${s.status}" but sent_at is NULL`,
        fields: { status: s.status, sent_at: null, sent_via_civia: s.sent_via_civia },
      });
    }

    // ANOMALY 2: Status "trimis"/"inregistrata" but sent_via_civia = false
    // (means it was set manually in admin, not via the send-via-civia flow)
    if ([SENT_STATUS, REGISTERED_STATUS].includes(s.status) && !s.sent_via_civia) {
      // This is OK if sent_at is set (manual admin update), but flag if both null
      if (!s.sent_at) {
        anomalies.push({
          code: s.code,
          problem: `Status "${s.status}" but sent_via_civia=false and sent_at=NULL (manual admin inconsistency)`,
          fields: { status: s.status, sent_via_civia: false, sent_at: null },
        });
      }
    }

    // ANOMALY 3: official_response_at is set but status is still "trimis"/"inregistrata"
    if ([SENT_STATUS, REGISTERED_STATUS].includes(s.status) && s.official_response_at) {
      anomalies.push({
        code: s.code,
        problem: `Status "${s.status}" but official_response_at is set (status should be advanced)`,
        fields: {
          status: s.status,
          official_response_at: s.official_response_at,
        },
      });
    }

    // ANOMALY 4: sent_at is old (>45 days) without official_response_at AND not escalated to AVP
    if (s.sent_at) {
      const sentDate = new Date(s.sent_at);
      const daysSinceSent = Math.floor((nowDate - sentDate) / (24 * 60 * 60 * 1000));
      
      if (daysSinceSent > AVP_ESCALATION_DAYS && !s.official_response_at && s.status !== "ignorat") {
        anomalies.push({
          code: s.code,
          problem: `Sent ${daysSinceSent} days ago without official_response_at and status NOT "ignorat" (should be escalated or marked ignorat)`,
          fields: {
            status: s.status,
            sent_at: s.sent_at,
            daysSinceSent,
            official_response_at: s.official_response_at,
          },
        });
      }
    }

    // ANOMALY 5: Status "ignorat" but official_response_at is set (contradictory)
    if (s.status === "ignorat" && s.official_response_at) {
      anomalies.push({
        code: s.code,
        problem: `Status "ignorat" but official_response_at is set (contradictory: ignorat means NO response)`,
        fields: {
          status: s.status,
          official_response_at: s.official_response_at,
        },
      });
    }

    // ANOMALY 6: Very old sesizari (>90 days) without response and not marked ignorat
    if (daysSinceFiled > 90 && !s.official_response_at && !FINAL_STATUSES.has(s.status)) {
      anomalies.push({
        code: s.code,
        problem: `${daysSinceFiled} days old without official_response_at and status "${s.status}" not in final/ignorat (critical escalation gap)`,
        fields: {
          status: s.status,
          daysSinceFiled,
          official_response_at: s.official_response_at,
        },
      });
    }

    // ANOMALY 7: Status "trimis" but timeline shows "inregistrata" events (status lag)
    const sesizareEvents = eventMap.get(s.id) || [];
    const hasRegistrationEvent = sesizareEvents.some(e => e.event_type === "inregistrata");
    if (s.status === SENT_STATUS && hasRegistrationEvent) {
      anomalies.push({
        code: s.code,
        problem: `Status "trimis" but timeline has "inregistrata" event (status should be advanced)`,
        fields: {
          status: s.status,
          timelineHasInregistrata: true,
        },
      });
    }

    // ANOMALY 8: resolved_at set but status is not "rezolvat"
    if (s.resolved_at && s.status !== "rezolvat") {
      anomalies.push({
        code: s.code,
        problem: `resolved_at is set but status "${s.status}" (should be "rezolvat")`,
        fields: {
          status: s.status,
          resolved_at: s.resolved_at,
        },
      });
    }
  }

  // Findings summary
  findings.push(`Total sesizari analyzed: ${sesizari.length}`);
  findings.push(`Anomalies detected: ${anomalies.length}`);

  // Group by anomaly type
  const anomalyTypes = {};
  for (const anom of anomalies) {
    const type = anom.problem.split(" but ")[0] || anom.problem;
    anomalyTypes[type] = (anomalyTypes[type] || 0) + 1;
  }

  findings.push("\n📋 Anomaly breakdown:");
  for (const [type, count] of Object.entries(anomalyTypes)) {
    findings.push(`  • ${type}: ${count}`);
  }

  // Count by status
  const statusCounts = {};
  for (const s of sesizari) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }

  findings.push("\n📊 Status distribution:");
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    findings.push(`  • ${status}: ${count}`);
  }

  // Metrics
  const sentViaVivia = sesizari.filter(s => s.sent_via_civia).length;
  const withOfficialResponse = sesizari.filter(s => s.official_response_at).length;
  const withResolvedAt = sesizari.filter(s => s.resolved_at).length;

  findings.push("\n📈 Key metrics:");
  findings.push(`  • Sent via Civia: ${sentViaVivia} (${((sentViaVivia / sesizari.length) * 100).toFixed(1)}%)`);
  findings.push(`  • With official_response_at: ${withOfficialResponse} (${((withOfficialResponse / sesizari.length) * 100).toFixed(1)}%)`);
  findings.push(`  • Resolved: ${withResolvedAt} (${((withResolvedAt / sesizari.length) * 100).toFixed(1)}%)`);

  // Print findings
  console.log("\n" + findings.join("\n"));

  // Print anomalies (first 50)
  if (anomalies.length > 0) {
    console.log("\n⚠️  TOP ANOMALIES (first 50):\n");
    for (let i = 0; i < Math.min(50, anomalies.length); i++) {
      const a = anomalies[i];
      console.log(`[${i + 1}] ${a.code}: ${a.problem}`);
      console.log(`    Fields: ${JSON.stringify(a.fields)}\n`);
    }

    if (anomalies.length > 50) {
      console.log(`... and ${anomalies.length - 50} more anomalies\n`);
    }
  }

  // Export detailed report
  console.log("\n📁 Exporting detailed JSON report...");
  const report = {
    timestamp: new Date().toISOString(),
    database: "Civia",
    summary: {
      totalSesizari: sesizari.length,
      totalAnomalies: anomalies.length,
      anomalyTypes: anomalyTypes,
      statusDistribution: statusCounts,
      metrics: {
        sentViaVivia,
        withOfficialResponse,
        withResolvedAt,
      },
    },
    findings,
    anomalies: anomalies.slice(0, 100), // First 100 for the report
  };

  console.log(JSON.stringify(report, null, 2));
}

auditDatabase().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

