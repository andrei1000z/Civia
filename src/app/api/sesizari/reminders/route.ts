import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  sendEmail,
  emailTemplate,
  emailGreeting,
  emailSectionTitle,
  emailStatCards,
  emailListCard,
  emailNoteCallout,
  escapeEmailHtml,
} from "@/lib/email/resend";
import { buildSalutation } from "@/lib/email/format";
import { SESIZARE_TIPURI } from "@/lib/constants";
import { safeTitlu } from "@/lib/sesizari/titlu";

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
  const isCron = verifyBearer(auth, cronSecret);

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

  // 2026-06-10 (audit statusuri) — include și `inregistrata`: un simplu ack de
  // înregistrare NU e răspuns pe fond (OG 27/2002 cere soluționare). Înainte,
  // sesizările confirmate dar fără răspuns real nu primeau NICIUN reminder →
  // buclă moartă (perechea fix-ului din auto-status). Gard suplimentar:
  // official_response_at IS NULL — nu remindui „n-a răspuns" când există răspuns
  // consemnat (ex: admin a marcat manual implicarea autorității).
  const { data: candidates, error } = await admin
    .from("sesizari")
    .select("id, code, titlu, descriere, tip, locatie, sector, created_at, author_email, author_name, status, moderation_status")
    .in("status", ["nou", "trimis", "raspuns_partial", "inregistrata"])
    .is("official_response_at", null)
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
    const titluSafe = safeTitlu(sez.titlu, { descriere: sez.descriere });
    const titluHtml = escapeEmailHtml(titluSafe);
    const preheader = `Sesizarea ${sez.code} · ${tipLabel} · ${sez.locatie ?? ""}`;
    const greeting = emailGreeting(
      buildSalutation({ fullName: sez.author_name, email: sez.author_email }),
      `${escapeEmailHtml(tipLabel)} · ${escapeEmailHtml(sez.locatie ?? "")}`,
    );

    // Nuanță pentru `inregistrata`: autoritatea A confirmat primirea, dar
    // confirmarea de înregistrare NU e răspuns pe fond (OG 27/2002 cere
    // soluționare, nu doar ack) — fără nuanță, „nu a răspuns" ar suna fals.
    const ackNote =
      sez.status === "inregistrata"
        ? emailNoteCallout({
            label: "Ai primit doar confirmarea de înregistrare",
            text: `Un număr de înregistrare nu e un răspuns. OG 27/2002 cere soluționarea sesizării, nu doar confirmarea că a ajuns.`,
            tone: "muted",
          })
        : "";

    if (step === "d7") {
      const subject = `Sesizarea „${titluSafe}" — ziua 7, încă în termen`;
      return {
        subject,
        html: emailTemplate({
          title: `Ziua 7 — încă în termen`,
          kicker: `REAMINTIRE · ZIUA 7`,
          icon: `⏳`,
          preheader,
          body: `
            ${greeting}
            <p style="margin:0 0 12px">Acum o săptămână ai trimis sesizarea <strong>„${titluHtml}"</strong>. Autoritatea nu a răspuns încă — și e în regulă: legea îi dă <strong>30 de zile</strong> (OG 27/2002 art. 14).</p>
            ${emailStatCards([
              { value: `7`, label: `zile de la trimitere` },
              { value: `23`, label: `zile rămase din termen` },
            ])}
            <p style="margin:14px 0 0">Dacă primești un răspuns între timp, adaugă-l pe pagina sesizării — îl văd și ceilalți care urmăresc problema.</p>
          `,
          ctaText: `Vezi sesizarea`,
          ctaUrl: link,
        }),
      };
    }

    if (step === "d14") {
      const subject = `Sesizarea „${titluSafe}" — jumătate din termen, niciun răspuns`;
      return {
        subject,
        html: emailTemplate({
          title: `Jumătate din termen a trecut`,
          kicker: `REAMINTIRE · ZIUA 14`,
          icon: `🔔`,
          accent: `#F59E0B`,
          preheader,
          body: `
            ${greeting}
            <p style="margin:0 0 12px">Au trecut <strong>14 zile</strong> — jumătate din termenul legal — și sesizarea <strong>„${titluHtml}"</strong> nu are încă niciun răspuns.</p>
            ${emailStatCards([
              { value: `14`, label: `zile de la trimitere` },
              { value: `16`, label: `zile până la termenul legal` },
            ])}
            ${emailSectionTitle(`Ce poți face acum`)}
            ${emailListCard([
              {
                title: `Dă sesizarea mai departe`,
                meta: `Trimite linkul unui consilier local sau pe grupul cartierului`,
                url: link,
              },
              {
                title: `Marchează ca rezolvată`,
                meta: `Dacă problema s-a rezolvat între timp, chiar fără răspuns oficial`,
                url: link,
              },
              {
                title: `Mai așteaptă 16 zile`,
                meta: `La ziua 30 expiră termenul legal și îți arătăm cum escaladezi`,
              },
            ])}
          `,
          ctaText: `Vezi sesizarea`,
          ctaUrl: link,
        }),
      };
    }

    if (step === "d30") {
      const subject = `Sesizarea „${titluSafe}" — termenul legal a expirat`;
      return {
        subject,
        html: emailTemplate({
          title: `Termenul legal a expirat`,
          kicker: `TERMEN LEGAL EXPIRAT`,
          icon: `⚖️`,
          accent: `#C2410C`,
          preheader,
          body: `
            ${greeting}
            <p style="margin:0 0 12px">Au trecut <strong>30 de zile</strong> de când ai trimis sesizarea <strong>„${titluHtml}"</strong> — termenul maxim în care <strong>OG 27/2002 art. 14</strong> obliga autoritatea să răspundă. Nu a făcut-o.</p>
            ${ackNote}
            ${emailSectionTitle(`Unde poți escalada`)}
            ${emailListCard([
              {
                title: `Avocatul Poporului`,
                meta: `Petiție online, gratuită — instituția care verifică pasivitatea autorităților`,
                url: `https://avp.ro`,
                badge: `GRATUIT`,
              },
              {
                title: `Prefectul județului`,
                meta: `Controlează legalitatea activității primăriilor din județ`,
              },
              {
                title: `Instanța de contencios administrativ`,
                meta: `Legea 554/2004 — tăcerea autorității e dovadă de pasivitate`,
              },
            ])}
            <p style="margin:14px 0 0">Iar dacă problema s-a rezolvat între timp, fără hârtii — marchează sesizarea ca rezolvată și adaugă o poză.</p>
          `,
          ctaText: `Vezi sesizarea`,
          ctaUrl: link,
        }),
      };
    }

    // d60 — ultimul reminder automat.
    const subject = `Sesizarea „${titluSafe}" — 60 de zile fără răspuns`;
    return {
      subject,
      html: emailTemplate({
        title: `60 de zile de tăcere`,
        kicker: `REAMINTIRE · ZIUA 60`,
        icon: `🚨`,
        accent: `#d70015`,
        preheader,
        body: `
          ${greeting}
          <p style="margin:0 0 12px">Au trecut <strong>60 de zile</strong> de la trimiterea sesizării <strong>„${titluHtml}"</strong> — dublul termenului legal din <strong>OG 27/2002 art. 14</strong>. Tăcerea autorității nu mai e o întârziere, e o dovadă.</p>
          ${ackNote}
          ${emailStatCards([
            { value: `60`, label: `zile fără răspuns` },
            { value: `2×`, label: `termenul legal, depășit` },
          ])}
          ${emailSectionTitle(`Ce poți face cu această dovadă`)}
          ${emailListCard([
            {
              title: `Avocatul Poporului`,
              meta: `Petiție online, gratuită — instituția care verifică pasivitatea autorităților`,
              url: `https://avp.ro`,
              badge: `GRATUIT`,
            },
            {
              title: `Instanța de contencios administrativ`,
              meta: `Legea 554/2004 — 60 de zile de tăcere e exact dovada de care ai nevoie`,
            },
            {
              title: `Prefectul județului`,
              meta: `Controlează legalitatea activității primăriilor din județ`,
            },
          ])}
          <p style="margin:14px 0 0">Sesizarea rămâne publică pe Civia, cu termenul depășit la vedere. Acesta e ultimul reminder automat — de aici încolo, pagina sesizării îți stă la dispoziție oricând.</p>
        `,
        ctaText: `Vezi sesizarea`,
        ctaUrl: link,
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
    // `inregistrata` = autoritatea a confirmat primirea — la 7/14 zile nu e nimic
    // de semnalat (ack-ul e normal). Reminder doar când termenul legal e depășit
    // (d30/d60) și tot nu există răspuns pe fond.
    if (sez.status === "inregistrata" && (step === "d7" || step === "d14")) continue;
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
    .select("id, code, titlu, descriere, author_email, author_name, resolved_at")
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
    const titluSafe = safeTitlu(sez.titlu, { descriere: sez.descriere });

    const subject = `Confirmi că s-a rezolvat? — "${titluSafe}"`;
    const html = emailTemplate({
      title: "Confirmi că problema s-a rezolvat?",
      kicker: "CIVIA · 14 ZILE DE LA REZOLVARE",
      preheader: `Sesizare ${sez.code} — confirmă cu 1 click`,
      body: `
        <p>Salut${sez.author_name ? ` ${sez.author_name.split(" ")[0]}` : ""},</p>
        <p>Acum 14 zile sesizarea ta <strong>"${titluSafe}"</strong> a fost marcată ca rezolvată. Confirmi că problema este într-adevăr rezolvată?</p>
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
