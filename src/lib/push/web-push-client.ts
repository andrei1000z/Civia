/**
 * Server-side Web Push delivery — folosește web-push npm cu VAPID.
 *
 * Configurare necesară (env vars):
 *   VAPID_PUBLIC_KEY  — public key (base64url)
 *   VAPID_PRIVATE_KEY — private key (base64url)
 *   VAPID_SUBJECT     — mailto:... (URL valid de contact)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — same ca VAPID_PUBLIC_KEY, exposed la client
 *
 * Generare keys nou:
 *   node -e "console.log(require('web-push').generateVAPIDKeys())"
 *
 * Daca VAPID_* lipsesc, sendPush() devine no-op (log + skip). Util in dev
 * fara push setup. Pentru a expune subscribers la server, folosim service
 * role direct — RLS-bypass — fiindca asta ruleaza in cron/server context.
 */

import webpush from "web-push";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !sub) {
    return false;
  }
  try {
    webpush.setVapidDetails(sub, pub, priv);
    configured = true;
    return true;
  } catch (e) {
    console.warn("[push] VAPID setup failed:", e);
    return false;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  /** URL relativ unde se navighează la click. */
  url?: string;
  /** Pentru coalescing — notificările cu același tag se înlocuiesc. */
  tag?: string;
  icon?: string;
}

/**
 * Trimite un payload de push la TOATE subscription-urile unui user.
 * Fire-and-forget pentru endpoints invalide — le ștergem din DB pentru
 * a evita rate-limit la FCM/Apple (provider-ii blochează după prea multe
 * 410 GONE).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!configure()) {
    console.warn("[push] skipping send — VAPID not configured");
    return { sent: 0, failed: 0 };
  }

  const admin = createSupabaseAdmin();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 24 }, // 24h, dupa care expira
        );
        // Actualizare last_used_at — best-effort, fire-and-forget
        admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id)
          .then(() => {/* noop */});
        sent += 1;
      } catch (e: unknown) {
        failed += 1;
        const status = (e as { statusCode?: number })?.statusCode;
        // 410 Gone / 404 = subscription expired/invalid → curățăm.
        if (status === 410 || status === 404) {
          staleIds.push(s.id);
        }
      }
    }),
  );

  // Cleanup subscription-uri moarte — provider-ul a confirmat că nu mai
  // există (user dezinstalat, browser revoke, etc.).
  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, failed };
}

/**
 * Trimite push la o listă de user_ids (în paralel). Util pentru notificări
 * group: street follows, sesizare followers, etc.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ total: number; sent: number; failed: number }> {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return { total: 0, sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    unique.map((uid) => sendPushToUser(uid, payload)),
  );

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      sent += r.value.sent;
      failed += r.value.failed;
    } else {
      failed += 1;
    }
  }
  return { total: unique.length, sent, failed };
}

/**
 * Trimite push la TOATE subscription-urile active — pentru broadcast events
 * gen „petiție nouă", „protest aprobat". Fire-and-forget; 410/404 cleanup
 * automat. Respectă opt-out simplu prin profiles.dismissed_prompts.no_broadcast.
 *
 * Atenție: poate trimite la 1000+ subscribers — chemati doar din event de tip
 * publish/approve, niciodată din loops sau req paths fierbinți.
 */
export async function broadcastToAllSubscribers(
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!configure()) {
    console.warn("[push] skipping broadcast — VAPID not configured");
    return { sent: 0, failed: 0 };
  }

  const admin = createSupabaseAdmin();
  // Pull ALL subscriptions cu opt-out filter pe profile.
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id, profiles!inner(dismissed_prompts)");

  if (error || !subs || subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Filter out users who explicitly opted out via dismissed_prompts.no_broadcast
  const active = subs.filter((s) => {
    const dp = (s as { profiles?: { dismissed_prompts?: Record<string, unknown> } }).profiles
      ?.dismissed_prompts;
    return !dp || dp.no_broadcast !== true;
  });

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    active.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (e: unknown) {
        failed += 1;
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) staleIds.push(s.id);
      }
    }),
  );

  if (staleIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, failed };
}

/** True dacă VAPID e configurat — pentru gating UI. */
export function isPushConfigured(): boolean {
  return (
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY &&
    !!process.env.VAPID_SUBJECT
  );
}
