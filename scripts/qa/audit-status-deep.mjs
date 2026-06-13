import { config } from "dotenv";
import { existsSync } from "fs";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AVP_ESCALATION_DAYS = 45;
const RESPONSE_DEADLINE_DAYS = 30;
const FINAL_STATUSES = new Set(["rezolvat", "respins", "ignorat"]);

async function auditDatabase() {
  console.log("🔍 CIVIA DATABASE COMPREHENSIVE AUDIT\n");

  // Main sesizari data
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

  // Timeline events
  const { data: events } = await supabase
    .from("sesizare_timeline")
    .select("sesizare_id, event_type, created_at, description");

  const eventMap = new Map();
  for (const event of events || []) {
    if (!eventMap.has(event.sesizare_id)) {
      eventMap.set(event.sesizare_id, []);
    }
    eventMap.get(event.sesizare_id).push(event);
  }

  console.log(`Total sesizari analyzed: ${sesizari.length}\n`);

  const anomalies = [];
  const patterns = {
    noSentTracking: [],
    orphanedResponses: [],
    overdue45: [],
    overdue60: [],
    overdue90: [],
    statusLag: [],
    orphanedResolved: [],
    conflictingIgnorat: [],
  };

  // Analyze each sesizare
  for (const s of sesizari) {
    const createdDate = new Date(s.created_at);
    const nowDate = new Date();
    const daysSinceFiled = Math.floor((nowDate - createdDate) / (24 * 60 * 60 * 1000));

    // Pattern 1: Status "inregistrata"/"trimis" but sent_at is NULL
    if (["trimis", "inregistrata"].includes(s.status) && !s.sent_at) {
      patterns.noSentTracking.push(s.code);
      anomalies.push({
        code: s.code,
        severity: "HIGH",
        category: "Metadata Gap",
        issue: `Status "${s.status}" without sent_at timestamp`,
      });
    }

    // Pattern 2: official_response_at is set but status still "trimis"/"inregistrata"
    if (["trimis", "inregistrata"].includes(s.status) && s.official_response_at) {
      patterns.orphanedResponses.push(s.code);
      anomalies.push({
        code: s.code,
        severity: "CRITICAL",
        category: "Status Lag",
        issue: `Has official_response_at but status "${s.status}" not advanced`,
      });
    }

    // Pattern 3: Overdue by 45+ days (AVP escalation threshold)
    if (s.sent_at) {
      const sentDate = new Date(s.sent_at);
      const daysSinceSent = Math.floor((nowDate - sentDate) / (24 * 60 * 60 * 1000));
      
      if (daysSinceSent > AVP_ESCALATION_DAYS && !s.official_response_at && s.status !== "ignorat") {
        if (daysSinceSent > 90) {
          patterns.overdue90.push(s.code);
          anomalies.push({
            code: s.code,
            severity: "CRITICAL",
            category: "Escalation Gap",
            issue: `${daysSinceSent} days without response - should be marked "ignorat" or escalated`,
          });
        } else if (daysSinceSent > 60) {
          patterns.overdue60.push(s.code);
          anomalies.push({
            code: s.code,
            severity: "HIGH",
            category: "Escalation Gap",
            issue: `${daysSinceSent} days without response - approaching critical escalation`,
          });
        } else {
          patterns.overdue45.push(s.code);
        }
      }
    }

    // Pattern 4: Status "trimis" but timeline shows "inregistrata" event
    const timelineEvents = eventMap.get(s.id) || [];
    if (s.status === "trimis" && timelineEvents.some(e => e.event_type === "inregistrata")) {
      patterns.statusLag.push(s.code);
      anomalies.push({
        code: s.code,
        severity: "HIGH",
        category: "Status Lag",
        issue: `Status "trimis" but timeline records "inregistrata" - status not synchronized`,
      });
    }

    // Pattern 5: resolved_at set but status not "rezolvat"
    if (s.resolved_at && s.status !== "rezolvat") {
      patterns.orphanedResolved.push(s.code);
      anomalies.push({
        code: s.code,
        severity: "HIGH",
        category: "Metadata Mismatch",
        issue: `resolved_at set but status "${s.status}" (should be "rezolvat")`,
      });
    }

    // Pattern 6: Status "ignorat" but official_response_at is set
    if (s.status === "ignorat" && s.official_response_at) {
      patterns.conflictingIgnorat.push(s.code);
      anomalies.push({
        code: s.code,
        severity: "CRITICAL",
        category: "Logic Conflict",
        issue: `Status "ignorat" contradicts official_response_at being set`,
      });
    }
  }

  // Print summary
  console.log("=" * 60);
  console.log("CRITICAL ISSUES SUMMARY\n");
  
  const criticalCount = anomalies.filter(a => a.severity === "CRITICAL").length;
  const highCount = anomalies.filter(a => a.severity === "HIGH").length;
  
  console.log(`Critical Issues: ${criticalCount}`);
  console.log(`High Priority: ${highCount}`);
  console.log(`Total Anomalies: ${anomalies.length}\n`);

  // Print by category
  const byCategory = {};
  for (const anom of anomalies) {
    if (!byCategory[anom.category]) byCategory[anom.category] = [];
    byCategory[anom.category].push(anom);
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    console.log(`\n${cat} (${items.length}):`);
    for (const item of items.slice(0, 5)) {
      console.log(`  • ${item.code}: ${item.issue}`);
    }
    if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
  }

  // Status distribution
  const statusCounts = {};
  for (const s of sesizari) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }

  console.log("\n" + "=".repeat(60));
  console.log("STATUS DISTRIBUTION\n");
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(18)}: ${count.toString().padStart(3)} (${((count / sesizari.length) * 100).toFixed(1)}%)`);
  }

  // Key metrics
  const sentViaVivia = sesizari.filter(s => s.sent_via_civia).length;
  const withResponse = sesizari.filter(s => s.official_response_at).length;
  const resolved = sesizari.filter(s => s.resolved_at).length;
  const nullSentAt = sesizari.filter(s => ["trimis", "inregistrata"].includes(s.status) && !s.sent_at).length;

  console.log("\n" + "=".repeat(60));
  console.log("KEY METRICS\n");
  console.log(`  Sent via Civia:           ${sentViaVivia} / ${sesizari.length} (${((sentViaVivia / sesizari.length) * 100).toFixed(1)}%)`);
  console.log(`  With official response:   ${withResponse} / ${sesizari.length} (${((withResponse / sesizari.length) * 100).toFixed(1)}%)`);
  console.log(`  Marked resolved:          ${resolved} / ${sesizari.length} (${((resolved / sesizari.length) * 100).toFixed(1)}%)`);
  console.log(`  Status with null sent_at: ${nullSentAt} / ${sesizari.length} (${((nullSentAt / sesizari.length) * 100).toFixed(1)}%)`);

  // Escalation readiness
  console.log("\n" + "=".repeat(60));
  console.log("ESCALATION READINESS (AVP)\n");
  console.log(`  Overdue 45+ days:  ${patterns.overdue45.length}`);
  console.log(`  Overdue 60+ days:  ${patterns.overdue60.length}`);
  console.log(`  Overdue 90+ days:  ${patterns.overdue90.length}`);

  // Print anomalies by severity
  console.log("\n" + "=".repeat(60));
  console.log("ALL ANOMALIES BY SEVERITY\n");
  
  for (const severity of ["CRITICAL", "HIGH"]) {
    const items = anomalies.filter(a => a.severity === severity);
    if (items.length > 0) {
      console.log(`\n${severity} (${items.length}):`);
      for (const item of items) {
        console.log(`  [${item.code}] ${item.category} - ${item.issue}`);
      }
    }
  }

  // Export JSON
  console.log("\n" + "=".repeat(60));
  console.log("JSON EXPORT\n");
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSesizari: sesizari.length,
      totalAnomalies: anomalies.length,
      criticalIssues: criticalCount,
      highPriorityIssues: highCount,
    },
    metrics: {
      sentViaVivia,
      withOfficialResponse: withResponse,
      resolved,
      nullSentAtInActiveStatus: nullSentAt,
    },
    escalationReadiness: {
      overdue45Days: patterns.overdue45.length,
      overdue60Days: patterns.overdue60.length,
      overdue90Days: patterns.overdue90.length,
    },
    patterns: {
      noSentTracking: patterns.noSentTracking,
      orphanedResponses: patterns.orphanedResponses,
      statusLag: patterns.statusLag,
      orphanedResolved: patterns.orphanedResolved,
      conflictingIgnorat: patterns.conflictingIgnorat,
    },
    anomaliesBySeverity: {
      critical: anomalies.filter(a => a.severity === "CRITICAL").map(a => a.code),
      high: anomalies.filter(a => a.severity === "HIGH").map(a => a.code),
    },
    statusDistribution: statusCounts,
  };

  console.log(JSON.stringify(report, null, 2));
}

auditDatabase().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
