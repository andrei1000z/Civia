import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { SESIZARE_TIPURI } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

/**
 * Cron handler — auto-reminders pentru sesizari fara raspuns autoritate.
 *
 * OG 27/2002 art. 14 obliga primaria sa raspunda in 30 zile. Scanam zilnic
 * sesizarile cu status="nou" sau "trimis", calculam varsta, si daca am
 * trecut milestone-uri 7/14/30/60 zile fara ca acea sesizare sa fi primit
 * deja un reminder pentru milestone-ul respectiv, trimitem email cu CTA
 * escaladare.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (Vercel cron) sau admin session.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;

  if (!isCron) {
    // Allow manual trigger by admin for testing.
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const admin = createSupabaseAdmin();

  // Look for sesizari with status ∈ ('nou', 'trimis', 'raspuns_partial')
  // that have created_at >= 60 zile in urma. (Older ones — drop, expired.)
  const cutoffOldest = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
  const cutoffNewest = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, tip, locatie, sector, created_at, author_email, author_name, status, moderation_status")
    .in("status", ["nou", "trimis", "raspuns_partial"])
    .eq("moderation_status", "approved")
    .gte("created_at", cutoffOldest)
    .lte("created_at", cutoffNewest)
    .not("author_email", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, sent: 0 });
  }

  // Look at already-sent reminders so we don't duplicate.
  const ids = candidates.map((c) => c.id);
  const { data: alreadySent } = await admin
    .from("sesizari_reminders")
    .select("sesizare_id, step")
    .in("sesizare_id", ids);
  const sentMap = new Map<string, Set<string>>();
  for (const row of alreadySent ?? []) {
    let set = sentMap.get(row.sesizare_id);
    if (!set) {
      set = new Set();
      sentMap.set(row.sesizare_id, set);
    }
    set.add(row.step);
  }

  type Step = "d7" | "d14" | "d30" | "d60";
  function pickStep(daysOld: number): Step | null {
    if (daysOld >= 60) return "d60";
    if (daysOld >= 30) return "d30";
    if (daysOld >= 14) return "d14";
    if (daysOld >= 7) return "d7";
    return null;
  }

  type Candidate = NonNullable<typeof candidates>[number];
  function buildBody(step: Step, sez: Candidate): { subject: string; html: string } {
    const tipMeta = SESIZARE_TIPURI.find((t) => t.value === sez.tip);
    const tipLabel = tipMeta?.label ?? sez.tip;
    const link = `${SITE_URL}/sesizari/${sez.code}`;

    let bodyHtml = "";
    let subject = "";

    if (step === "d7") {
      subject = `Sesizarea ta — "${sez.titlu}" — 7 zile fara raspuns`;
      bodyHtml = `
        <p>Salut${sez.author_name ? ` ${sez.author_name.split(" ")[0]}` : ""},</p>
        <p>Au trecut <strong>7 zile</strong> de cand ai depus sesizarea <strong>"${sez.titlu}"</strong> (${tipLabel}, ${sez.locatie}).</p>
        <p>E inca devreme — primaria are <strong>30 de zile legale</strong> sa raspunda (OG 27/2002 art. 14). Daca primesti un raspuns intre timp, raporteaza-l pe Civia ca sa-l vada toata lumea.</p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${link}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Vezi sesizarea</a>
        </p>
      `;
    } else if (step === "d14") {
      subject = `Sesizare "${sez.titlu}" — la jumate din termen, niciun raspuns`;
      bodyHtml = `
        <p>Salut${sez.author_name ? ` ${sez.author_name.split(" ")[0]}` : ""},</p>
        <p>Au trecut <strong>14 zile</strong> (jumate din termenul legal) si autoritatea inca nu a raspuns la sesizarea <strong>"${sez.titlu}"</strong>.</p>
        <p>Ce poti face acum:</p>
        <ul>
          <li>Daca cunosti un consilier local, forwardeaza-i sesizarea (link de mai jos)</li>
          <li>Marcheaza ca rezolvata daca s-a rezolvat fara raspuns oficial</li>
          <li>Asteapta inca 16 zile inainte de escaladare</li>
        </ul>
        <p style="margin:24px 0;text-align:center;">
          <a href="${link}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Vezi sesizarea</a>
        </p>
      `;
    } else if (step === "d30") {
      subject = `Sesizare "${sez.titlu}" — termen legal expirat, escaladeaza`;
      bodyHtml = `
        <p>Salut${sez.author_name ? ` ${sez.author_name.split(" ")[0]}` : ""},</p>
        <p>Au trecut <strong>30 de zile</strong> de cand ai depus sesizarea <strong>"${sez.titlu}"</strong>. Asta e termenul maxim legal prevazut de <strong>OG 27/2002 art. 14</strong>. Daca autoritatea nu a raspuns, ai dreptul sa escaladezi:</p>
        <ul>
          <li><strong>Avocatul Poporului</strong> — petitie online <a href="https://avp.ro">avp.ro</a></li>
          <li><strong>Sesizare in instanta</strong> — Legea contenciosului administrativ 554/2004</li>
          <li><strong>Plangere la prefectul judetului</strong> — controleaza primariile din zona</li>
        </ul>
        <p>Sau, daca s-a rezolvat informal, marcheaza ca rezolvata cu o poza after.</p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${link}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Vezi sesizarea</a>
        </p>
      `;
    } else {
      subject = `Sesizare "${sez.titlu}" — 60 zile fara raspuns`;
      bodyHtml = `
        <p>Salut${sez.author_name ? ` ${sez.author_name.split(" ")[0]}` : ""},</p>
        <p>Au trecut <strong>60 de zile</strong> de la depunerea sesizarii <strong>"${sez.titlu}"</strong> si nicio reactie de la autoritate. Asta inseamna ca:</p>
        <ul>
          <li>Termenul legal e dublu depasit</li>
          <li>Daca decizi sa actionezi in instanta, ai dovada de pasivitate</li>
          <li>Public, sesizarea ramane vizibila ca rusine institutionala</li>
        </ul>
        <p>Acesta e ultimul reminder automat din partea Civia.</p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${link}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Vezi sesizarea</a>
        </p>
      `;
    }

    return {
      subject,
      html: emailTemplate({
        title: subject,
        kicker: "CIVIA · REMINDER",
        preheader: `Sesizare ${sez.code}: ${tipLabel} - ${sez.locatie}`,
        body: bodyHtml,
      }),
    };
  }

  let sent = 0;
  let failed = 0;
  const successInserts: { sesizare_id: string; step: string; channel: string }[] = [];
  for (const sez of candidates) {
    const daysOld = Math.floor((Date.now() - new Date(sez.created_at).getTime()) / (24 * 60 * 60 * 1000));
    const step = pickStep(daysOld);
    if (!step) continue;
    if (sentMap.get(sez.id)?.has(step)) continue;
    if (!sez.author_email) continue;

    const { subject, html } = buildBody(step, sez);

    try {
      await sendEmail({ to: sez.author_email, subject, html });
      // 2026-05-25 OPTIMIZATION: collect pentru batch INSERT la sfârșit
      // (în loc de INSERT individual per row × 60 rows = 60 DB calls).
      successInserts.push({ sesizare_id: sez.id, step, channel: "email" });
      sent += 1;
    } catch {
      failed += 1;
    }

    // Rate-limit (Resend free tier: 10/sec).
    await new Promise((r) => setTimeout(r, 150));
  }

  // BATCH INSERT — single DB roundtrip în loc de N×INSERT. Salvare 60 calls/run.
  if (successInserts.length > 0) {
    await admin.from("sesizari_reminders").insert(successInserts);
  }

  // 2026-05-25 #31 — Closed-loop follow-up T+14 pentru sesizari rezolvate.
  // North-star metric: % cetățeni care confirmă rezolvarea după 14 zile.
  // Per MySociety FixMyStreet research, asta e singura metrică non-falsifiable
  // pentru civic platforms.
  const loopResult = await sendClosedLoopFollowups(admin);

  return NextResponse.json({
    ok: true,
    reminders: { scanned: candidates.length, sent, failed },
    closedLoop: loopResult,
  });
}

/**
 * 2026-05-25 #31 — Trimite email confirmation 14 zile după marcare rezolvat.
 *
 * Scan sesizari cu:
 *   - status = "rezolvat"
 *   - resolved_at între T-15d și T-13d (fereastră 48h, exact 14d ± 1d)
 *   - author_email NOT NULL
 *   - moderation_status = "approved"
 *   - NICI un reminder cu step="loop-followup" deja trimis
 *
 * Email conține 2 link-uri 1-tap:
 *   /api/sesizari/[code]/loop-confirm?outcome=yes
 *   /api/sesizari/[code]/loop-confirm?outcome=no
 * Cu HMAC token derivat din code+CRON_SECRET ca să prevenim spam.
 */
async function sendClosedLoopFollowups(
  admin: ReturnType<typeof createSupabaseAdmin>,
): Promise<{ scanned: number; sent: number; failed: number }> {
  const t15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const t13 = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates } = await admin
    .from("sesizari")
    .select("id, code, titlu, author_email, author_name, resolved_at")
    .eq("status", "rezolvat")
    .eq("moderation_status", "approved")
    .gte("resolved_at", t15)
    .lte("resolved_at", t13)
    .not("author_email", "is", null);

  if (!candidates || candidates.length === 0) {
    return { scanned: 0, sent: 0, failed: 0 };
  }

  const ids = candidates.map((c) => c.id);
  const { data: alreadySent } = await admin
    .from("sesizari_reminders")
    .select("sesizare_id")
    .in("sesizare_id", ids)
    .eq("step", "loop-followup");
  const sentSet = new Set((alreadySent ?? []).map((r) => r.sesizare_id));

  const cronSecret = process.env.CRON_SECRET ?? "";
  let sent = 0;
  let failed = 0;
  const inserts: { sesizare_id: string; step: string; channel: string }[] = [];

  for (const sez of candidates) {
    if (sentSet.has(sez.id)) continue;
    if (!sez.author_email) continue;
    // HMAC token simplu: hash(code + secret), 12 chars.
    const tokenSrc = `${sez.code}:${cronSecret}`;
    const { createHash } = await import("crypto");
    const token = createHash("sha256").update(tokenSrc).digest("hex").slice(0, 12);
    const yesLink = `${SITE_URL}/api/sesizari/${sez.code}/loop-confirm?outcome=yes&t=${token}`;
    const noLink = `${SITE_URL}/api/sesizari/${sez.code}/loop-confirm?outcome=no&t=${token}`;

    const subject = `Confirmi că s-a rezolvat? — "${sez.titlu}"`;
    const html = emailTemplate({
      title: "Confirmi că problema s-a rezolvat?",
      kicker: "CIVIA · 14 ZILE DE LA REZOLVARE",
      preheader: `Sesizare ${sez.code} — confirmă cu 1 click`,
      body: `
        <p>Salut${sez.author_name ? ` ${sez.author_name.split(" ")[0]}` : ""},</p>
        <p>Acum 14 zile sesizarea ta <strong>"${sez.titlu}"</strong> a fost marcată ca rezolvată. Confirmi că problema este într-adevăr rezolvată?</p>
        <p style="margin:24px 0;text-align:center;">
          <a href="${yesLink}" style="background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;">✓ DA, e rezolvată</a>
          <a href="${noLink}" style="background:#DC2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">✗ NU, nu chiar</a>
        </p>
        <p style="font-size:13px;color:#666">Răspunsul tău alimentează North-Star metric Civia: <strong>Closed-Loop Sesizari</strong> — singura metrică pe care primăriile nu o pot „umfla". Mulțumim!</p>
      `,
    });

    try {
      await sendEmail({ to: sez.author_email, subject, html });
      inserts.push({ sesizare_id: sez.id, step: "loop-followup", channel: "email" });
      sent += 1;
    } catch {
      failed += 1;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  if (inserts.length > 0) {
    await admin.from("sesizari_reminders").insert(inserts);
  }

  return { scanned: candidates.length, sent, failed };
}
