/**
 * GET /api/admin/sentry-test
 *
 * Diagnostic one-shot: aruncă un error intenționat ca să confirm Sentry
 * wireup funcționează (events ajung la sentry.io).
 *
 * Admin-only. După ce confirmăm că events apar în Sentry, ștergem
 * acest endpoint (sau lăsăm pentru future smoke tests).
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Diagnostic: este SDK inițializat?
  const client = Sentry.getClient();
  const sdkInitialized = !!client;
  const dsn = client?.getDsn ? JSON.stringify(client.getDsn()) : "no client";
  const options = client?.getOptions ? client.getOptions() : null;

  // Method 1: Sentry.captureException explicit
  const eventId1 = Sentry.captureException(new Error("Sentry wireup test — captureException"), {
    tags: { route: "/api/admin/sentry-test", method: "captureException" },
    extra: { triggered_at: new Date().toISOString() },
  });

  // Method 2: Sentry.captureMessage
  const eventId2 = Sentry.captureMessage("Sentry wireup test — captureMessage", "warning");

  // Force flush ca să fim siguri că events ies din process înainte de
  // serverless function termination.
  await Sentry.flush(5000).catch((e) => ({ flushError: String(e) }));

  return NextResponse.json({
    ok: true,
    diag: {
      sdkInitialized,
      hasClient: !!client,
      dsn: dsn.slice(0, 100),
      enabled: options?.enabled,
      environment: options?.environment,
      release: options?.release,
      sampleRate: options?.sampleRate,
      NODE_ENV: process.env.NODE_ENV,
      DSN_env_present: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      DSN_env_prefix: process.env.NEXT_PUBLIC_SENTRY_DSN?.slice(0, 30),
      eventId1,
      eventId2,
    },
    timestamp: new Date().toISOString(),
  });
}
