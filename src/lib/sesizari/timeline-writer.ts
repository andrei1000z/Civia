import * as Sentry from "@sentry/nextjs";
// 2026-05-27 — import prin wrapper (AGENTS.md).
import type { SupabaseClient } from "@/lib/supabase/types";
import { isRedundantEventDescription } from "./events";

interface AppendArgs {
  /** Service-role client. Caller is responsible for RLS bypass. */
  admin: SupabaseClient;
  sesizareId: string;
  /** event_type key — must match an entry in SESIZARE_EVENT_META. */
  eventType: string;
  /** Free-text or null. Pass the admin/citizen note when present;
   *  null/empty/generic descriptions are treated as "no real content"
   *  for dedup purposes. */
  description: string | null;
  /** Optional explicit timestamp (the moment when the event happened
   *  in the real world). Defaults to `now()` via the column default. */
  createdAt?: string;
  /** Optional user id stamped on the row (send-via-civia / cosign flows
   *  record who triggered the send). */
  createdBy?: string | null;
  /** Tags forwarded to Sentry on failure for observability. */
  sentryTags?: Record<string, string>;
  /** Extra context attached to the Sentry breadcrumb. */
  sentryExtra?: Record<string, unknown>;
}

interface AppendResult {
  /** True if a row was written. False when we deduped against the
   *  most recent existing row. */
  written: boolean;
  /** Set when the insert failed with a DB error. The row was NOT
   *  written; the caller may surface the error to the admin. */
  error?: string;
}

/**
 * Append a timeline event to a sesizare with built-in dedup.
 *
 * Two writers can land timeline rows for the same logical action — the
 * manual admin status route AND the ticket approval route. If a citizen
 * proposed a status the admin had already applied manually (or the
 * other way around), the queue produces a second row whose description
 * is just `Status actualizat la: <status>`. The renderer then hides
 * that description as "redundant" via `isRedundantEventDescription`,
 * leaving two visually identical rows in the timeline.
 *
 * Rule: if the LATEST existing timeline row for this sesizare has the
 * same `event_type` AND the new row's description is null/empty/generic
 * (i.e. would be hidden anyway), skip the write. A new row with a real
 * admin/citizen note still goes through — those carry information.
 */
export async function appendTimelineEvent(args: AppendArgs): Promise<AppendResult> {
  const { admin, sesizareId, eventType, description, createdAt, createdBy, sentryTags, sentryExtra } =
    args;

  const trimmedDescription = description?.trim() ?? "";
  const newRowIsGeneric =
    !trimmedDescription || isRedundantEventDescription(eventType, trimmedDescription);

  // Cheap dedup check: just the most recent row for this sesizare. We
  // don't scan the whole history because the timeline is ordered by
  // created_at and the only realistic dup is "same event_type as the
  // last thing that happened".
  const { data: latest } = await admin
    .from("sesizare_timeline")
    .select("event_type")
    .eq("sesizare_id", sesizareId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestEventType = (latest as { event_type?: string } | null)?.event_type ?? null;

  if (newRowIsGeneric && latestEventType === eventType) {
    return { written: false };
  }

  const payload: Record<string, unknown> = {
    sesizare_id: sesizareId,
    event_type: eventType,
    description: trimmedDescription || `Status actualizat la: ${eventType}`,
  };
  if (createdAt) payload.created_at = createdAt;
  if (createdBy !== undefined) payload.created_by = createdBy;

  const { error } = await admin.from("sesizare_timeline").insert(payload);

  if (error) {
    Sentry.captureException(error, {
      tags: { kind: "timeline_insert", ...(sentryTags ?? {}) },
      extra: { sesizareId, eventType, ...(sentryExtra ?? {}) },
    });
    return { written: false, error: error.message };
  }

  return { written: true };
}
