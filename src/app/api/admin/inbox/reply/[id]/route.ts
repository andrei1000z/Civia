import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";
import { logAdminAction } from "@/lib/audit";

// Statusurile de reply care corespund unui status de sesizare valid + avansabil.
const ADVANCING = new Set(["inregistrata", "in-lucru", "rezolvat", "redirectionata"]);

export const dynamic = "force-dynamic";

/**
 * 2026-06-07 (audit P1) — review MANUAL admin pentru replies „necunoscut".
 *
 * Când AI clasifică greșit (sau „necunoscut" pe răspuns real în PDF), adminul
 * corectează aici clasificarea răspunsului ȘI, opțional, avansează statusul
 * sesizării. Refolosește computeStatusUpdate (forward-only — nu regresăm un
 * status mai avansat) + logAdminAction (audit).
 */
const schema = z.object({
  reply_status: z.enum([
    "inregistrata",
    "in-lucru",
    "rezolvat",
    "redirectionata",
    "respins",
    "cerere_informatii",
    "necunoscut",
  ]),
  apply_to_sesizare: z.boolean().default(false),
  // 2026-06-08 — legare manuală orfan: codul sesizării la care se leagă reply-ul
  // (când AI/matching n-a găsit-o automat). Doar dacă reply-ul e încă orfan.
  link_code: z.string().trim().min(1).max(12).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const rl = await rateLimitAsync(`admin-reply-review:${user.id}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe modificări" }, { status: 429 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }
  const { reply_status, apply_to_sesizare, link_code } = parsed.data;

  const admin = createSupabaseAdmin();
  const { data: reply } = await admin
    .from("sesizare_replies")
    .select("id, sesizare_id, ai_status, ai_nr_inregistrare, ai_summary, received_at")
    .eq("id", id)
    .maybeSingle();
  if (!reply) return NextResponse.json({ error: "Reply not found" }, { status: 404 });

  const prevStatus = (reply as { ai_status: string | null }).ai_status;
  // 2026-06-15 — timestamp-ul de status = ora REALĂ a emailului autorității
  // (received_at, setat din header-ul Date), nu ora la care adminul confirmă.
  const replyReceivedAt = (reply as { received_at?: string | null }).received_at ?? new Date().toISOString();

  // 0. Legare manuală orfan: dacă reply-ul n-are sesizare_id ȘI s-a dat link_code,
  //    rezolvăm codul → id. Devine sesizareId-ul folosit mai jos.
  let sesizareId = (reply as { sesizare_id: string | null }).sesizare_id;
  let linkedNow = false;
  if (!sesizareId && link_code) {
    const { data: target } = await admin
      .from("sesizari")
      .select("id")
      .eq("code", link_code)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: `Sesizarea ${link_code} nu există` }, { status: 404 });
    }
    sesizareId = (target as { id: string }).id;
    linkedNow = true;
  }

  // 1. Corectează clasificarea răspunsului (override admin) + leagă orfanul.
  const replyUpdate: Record<string, unknown> = {
    ai_status: reply_status,
    user_confirmed: true,
    user_corrected_status: reply_status,
  };
  if (linkedNow) {
    replyUpdate.sesizare_id = sesizareId;
    replyUpdate.match_method = "manual";
  }
  const { error: upErr } = await admin
    .from("sesizare_replies")
    .update(replyUpdate)
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 2. Opțional: aplică statusul pe sesizare. OVERRIDE ADMIN — admin e trusted,
  //    deci NU forward-only (forward-only e doar pt. ack-uri AUTOMATE; un om
  //    trebuie să poată CORECTA un status greșit, inclusiv în jos). Audit logat.
  //    Review #1: înainte computeStatusUpdate (forward-only) refuza tăcut un
  //    downgrade → adminul credea că a reparat, dar sesizarea rămânea greșită.
  let sesizareStatus: string | null = null;
  // sesizareId rezolvat mai sus (din reply.sesizare_id sau din link_code).
  if (apply_to_sesizare && sesizareId && ADVANCING.has(reply_status)) {
    const { data: ses } = await admin
      .from("sesizari")
      .select("id, code, status")
      .eq("id", sesizareId)
      .maybeSingle();
    if (ses) {
      const curr = (ses as { status: string }).status;
      if (reply_status !== curr) {
        const upd: Record<string, unknown> = { status: reply_status };
        const nr = (reply as { ai_nr_inregistrare: string | null }).ai_nr_inregistrare;
        if (nr && nr.trim()) upd.nr_inregistrare = nr.trim();
        const summary = (reply as { ai_summary: string | null }).ai_summary;
        const substantive = ["in-lucru", "rezolvat", "redirectionata"].includes(reply_status);
        if (substantive && summary && summary.trim().length > 20) {
          upd.official_response = summary.trim();
          upd.official_response_at = replyReceivedAt;
        }
        await admin.from("sesizari").update(upd).eq("id", (ses as { id: string }).id);
        // Review #2: writer canonic (dedup) în loc de insert raw.
        await appendTimelineEvent({
          admin,
          sesizareId: (ses as { id: string }).id,
          eventType: reply_status,
          description: "Status actualizat de admin după revizuirea manuală a unui răspuns oficial.",
          createdAt: replyReceivedAt,
          sentryTags: { source: "admin_inbox_reply_review" },
        });
      }
      sesizareStatus = reply_status; // setat chiar și pe no-op → fără „eșec tăcut"
    }
  }

  await logAdminAction({
    req,
    actorId: user.id,
    action: "reply.manual_review",
    targetType: "sesizare_reply",
    targetId: id,
    before: { ai_status: prevStatus },
    after: { reply_status, sesizare_status: sesizareStatus },
    metadata: { applied_to_sesizare: apply_to_sesizare },
  });

  return NextResponse.json({ ok: true, sesizareStatus });
}
