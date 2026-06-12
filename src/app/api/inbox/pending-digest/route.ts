import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { analyticsD1 } from "@/lib/analytics/d1-client";
import {
  categorizePending,
  digestSignature,
  shouldSendDigest,
  buildDigestEmail,
  type DigestReply,
  type DigestSesizare,
} from "@/lib/inbox/pending-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
const ADMIN_EMAIL =
  process.env.INBOX_DIGEST_EMAIL || process.env.ADMIN_EMAIL || "contact@civia.ro";

const SIG_KEY = "inbox:digest:sig";
const SENT_KEY = "inbox:digest:sentAt";

/**
 * Digest „coada de inbox neprocesată" → email către admin.
 *
 * Răspunsurile de fond (sancțiuni, intervenții, redirect-spre-remediere) nu trec
 * gate-ul de auto-apply sau vin ca orfani → putrezeau în coada de revizuire.
 * Acest job (zilnic, din /api/cron/daily) le strânge și trimite adminului un
 * digest — DOAR când e ceva acționabil, și fără spam (vezi shouldSendDigest:
 * trimite la schimbarea setului sau săptămânal ca reminder).
 *
 * Auth: GET cu Bearer ${CRON_SECRET} (cron) sau sesiune admin.
 * `?preview=1` (admin): returnează secțiunile JSON fără throttle/trimitere.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const isCron = verifyBearer(auth, process.env.CRON_SECRET);
  let isAdmin = false;
  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((prof as { role?: string } | null)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    isAdmin = true;
  }

  const admin = createSupabaseAdmin();
  const { data: replies, error } = await admin
    .from("sesizare_replies")
    .select(
      "id, sesizare_id, ai_status, ai_confidence, ai_summary, from_email, authority_name, subject, received_at, auto_applied, user_confirmed, attachments",
    )
    .is("user_confirmed", null)
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set((replies ?? []).map((r) => r.sesizare_id).filter(Boolean))] as string[];
  const sesById: Record<string, DigestSesizare> = {};
  if (ids.length) {
    const { data: ses } = await admin.from("sesizari").select("id, code, status, locatie").in("id", ids);
    for (const s of ses ?? []) sesById[s.id] = s as DigestSesizare;
  }

  const now = Date.now();
  const sections = categorizePending((replies ?? []) as DigestReply[], sesById, now);
  const signature = digestSignature(sections);

  // Preview (admin) — nu atinge throttle-ul, nu trimite.
  const preview = new URL(req.url).searchParams.get("preview");
  if (preview === "1" && isAdmin) {
    return NextResponse.json({ ok: true, preview: true, sections, signature });
  }

  // Throttle persistat în D1 (degradează grațios dacă D1 lipsește: trimite când e ceva).
  let lastSignature: string | null = null;
  let lastSentAtMs: number | null = null;
  if (analyticsD1) {
    lastSignature = await analyticsD1.get<string>(SIG_KEY);
    const raw = await analyticsD1.get<string>(SENT_KEY);
    lastSentAtMs = raw ? Number(raw) : null;
  }

  const willSend = shouldSendDigest({
    totalActionable: sections.totalActionable,
    signature,
    lastSignature,
    lastSentAtMs,
    nowMs: now,
  });

  if (!willSend) {
    return NextResponse.json({
      ok: true,
      sent: false,
      totalActionable: sections.totalActionable,
      reason: sections.totalActionable === 0 ? "coadă curată" : "fără schimbări, sub fereastra de reminder",
    });
  }

  const { subject, html } = buildDigestEmail(sections, SITE);
  try {
    const res = await sendEmail({ to: ADMIN_EMAIL, subject, html });
    if (analyticsD1) {
      // TTL 60z: dacă jobul tace prea mult, semnătura veche expiră singură.
      await analyticsD1.set(SIG_KEY, signature, { ex: 60 * 86_400 });
      await analyticsD1.set(SENT_KEY, String(now), { ex: 60 * 86_400 });
    }
    return NextResponse.json({
      ok: true,
      sent: res.ok,
      to: ADMIN_EMAIL,
      totalActionable: sections.totalActionable,
      breakdown: {
        progresNeaplicat: sections.progresNeaplicat.length,
        orfaniProgres: sections.orfaniProgres.length,
        ocrEsuat: sections.ocrEsuat.length,
        orfaniInregistrare: sections.orfaniInregistrareCount,
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "inbox_digest_failed" } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "send failed" }, { status: 500 });
  }
}
