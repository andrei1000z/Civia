import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

/**
 * GET /api/sesizari/drafts/nudge — cron care trimite email nudge la 24h
 * pentru drafturi nefinalizate.
 *
 * Bucla:
 *   1. Caut drafturi cu nudged_at IS NULL și created_at între 24-72h în urmă
 *      (>72h = abandoned, nu mai bate user-ul la cap)
 *   2. Doar drafturi cu email și fără completed_sesizare_code
 *   3. Trimit email politicos cu deep-link la /sesizari?continue={draft_id}
 *   4. Marc nudged_at = now()
 *
 * Auth: Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = verifyBearer(auth, cronSecret);
  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const cutoffOldest = new Date(Date.now() - 72 * 60 * 60_000).toISOString();
  const cutoffNewest = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { data: drafts, error } = await admin
    .from("sesizari_drafts")
    .select("id, email, user_id, tip, titlu, locatie, descriere, created_at")
    .is("nudged_at", null)
    .is("completed_sesizare_code", null)
    .gte("created_at", cutoffOldest)
    .lte("created_at", cutoffNewest)
    .not("email", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!drafts || drafts.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  const failures: string[] = [];
  for (const d of drafts) {
    try {
      const resumeUrl = `${SITE_URL}/sesizari?continue=${d.id}`;
      const titleHint = d.titlu?.trim() || (d.locatie?.trim().slice(0, 60)) || "sesizarea";
      await sendEmail({
        to: d.email!,
        subject: `🔔 Ai început o sesizare ieri — vrei să o termini?`,
        html: emailTemplate({
          title: "Continuă sesizarea ta",
          kicker: "Draft salvat",
          icon: "📝",
          preheader: `Ai început o sesizare despre „${titleHint}". E nevoie de încă 1 minut.`,
          body: `
            <p>Salut,</p>
            <p>Ai început ieri o sesizare prin Civia despre <strong>„${escapeHtml(titleHint)}"</strong>, dar nu ai apucat să o termini.</p>
            <p>Datele sunt încă salvate — apasă butonul de jos și completezi doar restul. 1 minut și pleacă oficial către primărie.</p>
            <p style="font-size:13px;color:#64748b;margin-top:24px">Dacă nu mai e nevoie, ignoră emailul ăsta. Draftul va dispărea automat în 72h.</p>
          `,
          ctaText: "Continuă sesizarea →",
          ctaUrl: resumeUrl,
        }),
      });
      await admin.from("sesizari_drafts").update({ nudged_at: new Date().toISOString() }).eq("id", d.id);
      sent += 1;
    } catch (err) {
      failures.push(`${d.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, scanned: drafts.length, sent, failures: failures.length > 0 ? failures : undefined });
}
