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

  // Method 1: Sentry.captureException explicit
  Sentry.captureException(new Error("Sentry wireup test — captureException"), {
    tags: { route: "/api/admin/sentry-test", method: "captureException" },
    extra: { triggered_at: new Date().toISOString() },
  });

  // Method 2: Sentry.captureMessage
  Sentry.captureMessage("Sentry wireup test — captureMessage", "warning");

  // Method 3: actual throw (caught by Next.js error handler + onRequestError)
  // Comented out — am 2 deja, suficient pentru wireup test.
  // throw new Error("Sentry wireup test — uncaught throw");

  return NextResponse.json({
    ok: true,
    note: "Sent 2 test events to Sentry. Check andrei-z4/javascript-nextjs in ~10 sec.",
    timestamp: new Date().toISOString(),
  });
}
