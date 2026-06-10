import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import * as Sentry from "@sentry/nextjs";
import { dispatchAlertsForIntreruperi } from "@/lib/intreruperi/alerts-matcher";
import { loadInterruptions } from "@/lib/intreruperi/store";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 2026-05-25 — Manual dispatch endpoint pentru alerts matcher.
 *
 * Auth: Bearer CRON_SECRET sau admin role.
 * Default: dispatch pe toate intreruperile active din store.
 *
 * Folosit pentru:
 *   1. Debug / testing — trigger manual din admin panel sau curl
 *   2. Backfill — după adăugare abonat nou, vrei să-i trimitem alerts pe
 *      intreruperi existente care îl afectează (only first time — anti-spam
 *      respectat via notified_interruption_ids[])
 *   3. Cron job dedicat dacă vrem să separăm de /refresh
 */
export async function POST(req: Request) {
  // Auth: Bearer CRON_SECRET sau admin user.
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  let isCron = false;
  if (verifyBearer(auth, cronSecret)) {
    isCron = true;
  } else {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
  }
  void isCron;

  try {
    const { items } = await loadInterruptions();
    const now = Date.now();
    const active = items
      .filter((it) => new Date(it.endAt).getTime() > now)
      .filter((it) => it.status !== "anulat" && it.status !== "finalizat")
      .map((it) => ({
        id: it.id,
        type: it.type,
        county: it.county,
        sector: it.sector ?? null,
        addresses: it.addresses,
        reason: it.reason,
        start_at: it.startAt,
        end_at: it.endAt,
        source_entry_url: it.sourceEntryUrl ?? null,
        provider: it.provider,
      }));

    const stats = await dispatchAlertsForIntreruperi(active);

    return NextResponse.json({ ok: true, processed: active.length, ...stats });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "alerts_dispatch_manual" } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dispatch failed" },
      { status: 500 },
    );
  }
}
