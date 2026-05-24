import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/ratelimit";
import * as Sentry from "@sentry/nextjs";

/**
 * 2026-05-24 Faza 5 (security) — admin action audit log.
 *
 * Persistă în `public.admin_audit_log` (migrația 072). Folosit pe TOATE
 * acțiunile admin sensibile (moderate, delete, role change, featured,
 * etc.) pentru forensics + GDPR compliance.
 *
 * Niciodată THROW — eșec audit log NU trebuie să blocheze acțiunea
 * legitimă. Logăm la Sentry în caz de eroare.
 *
 * Exemplu:
 *   await logAdminAction({
 *     req,
 *     actorId: user.id,
 *     action: "sesizare.moderate",
 *     targetType: "sesizare",
 *     targetId: sesizare.id,
 *     before: { moderation_status: "pending" },
 *     after:  { moderation_status: "approved" },
 *     metadata: { reason: "spam filter cleared" },
 *   });
 */
export async function logAdminAction(opts: {
  /** Request object — pentru IP + user-agent. Optional. */
  req?: Request;
  actorId: string;
  /** Format: "{resource}.{verb}" — e.g. "sesizare.moderate". */
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    const ip = opts.req ? getClientIp(opts.req) : null;
    const userAgent = opts.req?.headers.get("user-agent")?.slice(0, 500) ?? null;
    const { error } = await admin.from("admin_audit_log").insert({
      actor_id: opts.actorId,
      action: opts.action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      before: opts.before ?? null,
      after: opts.after ?? null,
      ip,
      user_agent: userAgent,
      metadata: opts.metadata ?? null,
    });
    if (error) {
      Sentry.captureMessage("admin audit log insert failed", {
        level: "warning",
        extra: { action: opts.action, error: error.message },
      });
    }
  } catch (e) {
    Sentry.captureException(e, {
      tags: { kind: "audit_log_fail" },
      extra: { action: opts.action },
    });
  }
}
