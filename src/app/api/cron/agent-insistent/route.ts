/**
 * POST /api/cron/agent-insistent
 *
 * 🤖 BIG FEATURE #1: Agent AI „Insistent" — escalare automata sesizari nerespunse.
 *
 * Pipeline:
 *   Ziua 30: REAMINTIRE catre primarie + citare OG 27/2002 art. 8
 *   Ziua 45: CC catre Avocatul Poporului + Prefectura judet
 *   Ziua 60: Genereaza plangere contencios administrativ (PDF) pentru cetatean
 *
 * Run: zilnic la 09:00. Bearer auth CRON_SECRET.
 *
 * Query candidates: sesizari cu delivery_status='delivered' SAU 'partial_bounced'
 * AND zero replies in N zile AND escalation_stage < 3.
 *
 * Atentie: NU forteaza nicio actiune fara consensus user. Stage 60 doar GENEREAZA
 * PDF si trimite la cetatean cu CTA „Semneaza si depune la judecatorie". Civia NU
 * depune in numele cetateanului fara semnatura explicita.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/sanitize-headers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CandidateRow {
  id: string;
  code: string;
  titlu: string;
  formal_text: string | null;
  author_name: string | null;
  author_email: string | null;
  sent_at: string | null;
  sent_to_emails: string[] | null;
  escalation_stage: number | null;
  county: string | null;
  sector: string | null;
}

interface EscalationCandidate extends CandidateRow {
  days_since_sent: number;
  next_stage: 1 | 2 | 3;
}

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const now = Date.now();

  // Query: sesizari trimise > 30 zile + zero replies + escalation_stage < 3
  const { data: sesizariRaw, error } = await admin
    .from("sesizari")
    .select(
      "id, code, titlu, formal_text, author_name, author_email, sent_at, sent_to_emails, escalation_stage, county, sector",
    )
    .in("delivery_status", ["delivered", "partial_bounced"])
    .lt("escalation_stage", 3)
    .not("sent_at", "is", null)
    .lt("sent_at", new Date(now - 30 * 86400_000).toISOString())
    .limit(100);

  if (error) {
    Sentry.captureException(error, { tags: { cron: "agent-insistent" } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (sesizariRaw ?? []) as CandidateRow[];

  // Filter — exclude sesizari cu replies (zero strict)
  const candidates: EscalationCandidate[] = [];
  for (const sez of items) {
    const { count } = await admin
      .from("sesizare_replies")
      .select("id", { count: "exact", head: true })
      .eq("sesizare_id", sez.id);
    if (count && count > 0) continue; // a primit raspuns → no escalation

    const daysSince = Math.floor(
      (now - new Date(sez.sent_at!).getTime()) / 86400_000,
    );
    const currentStage = sez.escalation_stage ?? 0;
    let nextStage: 1 | 2 | 3 | null = null;
    if (daysSince >= 30 && currentStage < 1) nextStage = 1;
    else if (daysSince >= 45 && currentStage < 2) nextStage = 2;
    else if (daysSince >= 60 && currentStage < 3) nextStage = 3;
    if (!nextStage) continue;

    candidates.push({ ...sez, days_since_sent: daysSince, next_stage: nextStage });
  }

  const stats = { total_candidates: candidates.length, escalated_30: 0, escalated_45: 0, escalated_60: 0, errors: 0 };

  for (const c of candidates) {
    try {
      if (c.next_stage === 1) await escalateStage30(c, admin);
      else if (c.next_stage === 2) await escalateStage45(c, admin);
      else if (c.next_stage === 3) await escalateStage60(c, admin);

      await admin
        .from("sesizari")
        .update({
          escalation_stage: c.next_stage,
          escalation_last_at: new Date().toISOString(),
        })
        .eq("id", c.id);

      if (c.next_stage === 1) stats.escalated_30++;
      else if (c.next_stage === 2) stats.escalated_45++;
      else stats.escalated_60++;
    } catch (e) {
      Sentry.captureException(e, {
        tags: { cron: "agent-insistent", code: c.code, stage: String(c.next_stage) },
      });
      stats.errors++;
    }
  }

  return NextResponse.json({ ok: true, ...stats });
}

// ─── STAGE 1: Ziua 30 — Reamintire cu citare OG 27/2002 ───────────────────────

async function escalateStage30(
  c: EscalationCandidate,
  admin: ReturnType<typeof createSupabaseAdmin>,
) {
  const fromHeader = buildFromHeader(c.author_name, "sesizari@civia.ro");
  const subject = `[REAMINTIRE — Termen OG 27/2002 expirat] Sesizare ${c.code}`;
  const body =
`Bună ziua,

Am revenit cu o reamintire pentru sesizarea cu codul ${c.code} ("${c.titlu}"), depusă pe ${formatDateRo(c.sent_at!)} (${c.days_since_sent} zile în urmă).

Conform OG 27/2002 art. 8 alin. (1), autoritățile publice au obligația de a răspunde în 30 de zile de la înregistrarea petiției. Termenul de 30 zile s-a împlinit.

Vă reamintesc respectuos că, în lipsa unui răspuns în 15 zile suplimentare:
1. Voi notifica Instituția Avocatul Poporului (conform Legii 35/1997 art. 13).
2. Voi notifica Prefectura județului pentru depășire termen legal.
3. După 60 de zile totale de la sesizare, voi pregăti acțiune în contencios administrativ (Legea 554/2004).

Solicit comunicarea numărului de înregistrare al sesizării și a stadiului actual al soluționării.

Cu stimă,
${c.author_name ?? "Cetățean Civia"}
(retransmis automat prin Civia.ro)
`;

  await admin.from("sesizare_escalations").insert({
    sesizare_id: c.id,
    stage: 1,
    type: "reamintire-og27",
    sent_at: new Date().toISOString(),
  });

  await sendEmail({
    to: c.sent_to_emails ?? [],
    bcc: c.author_email ? [c.author_email] : undefined,
    subject,
    text: body,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
    replyTo: `sesizari+${c.code}@civia.ro`,
    from: fromHeader,
  });
}

// ─── STAGE 2: Ziua 45 — Notificare AVP + Prefectura ──────────────────────────

async function escalateStage45(
  c: EscalationCandidate,
  admin: ReturnType<typeof createSupabaseAdmin>,
) {
  const fromHeader = buildFromHeader(c.author_name, "sesizari@civia.ro");
  const subject = `[ESCALARE — Avocatul Poporului + Prefectura] Sesizare ${c.code}`;

  // Recipients escalation
  const recipients: string[] = ["relatii_publice@avp.ro"]; // Avocatul Poporului
  if (c.county) {
    const { getCountyById } = await import("@/data/counties");
    const county = getCountyById(c.county);
    if (county) {
      // Add Prefectura county (cataloged in autoritati-contact.ts)
      const { PREFECTURI } = await import("@/data/autoritati-contact");
      const pref = PREFECTURI[c.county];
      if (pref?.email) recipients.push(pref.email);
    }
  }
  // Include originalele in CC pentru transparenta
  const cc = c.sent_to_emails ?? [];

  const body =
`Către: Instituția Avocatul Poporului, Prefectura Județului

Subiect: Sesizare nerespunsă în termenul legal — Cod ${c.code}

În data de ${formatDateRo(c.sent_at!)} am depus o petiție la primăria competentă (vezi CC mai jos), conform OG 27/2002.

Au trecut ${c.days_since_sent} zile fără răspuns. Termenul legal de 30 de zile (art. 8 alin. 1) este depășit cu ${c.days_since_sent - 30} zile.

Solicit:
1. Avocatul Poporului — sesizarea instituției pentru depășire termen legal (Legea 35/1997 art. 13).
2. Prefectura — verificarea respectării legalității de către primărie (Legea 340/2004 art. 24).

Conținutul sesizării originale:
${c.formal_text ?? "(textul nu este disponibil)"}

Cu stimă,
${c.author_name ?? "Cetățean Civia"}
(escaladare automată prin Civia.ro)
`;

  await admin.from("sesizare_escalations").insert({
    sesizare_id: c.id,
    stage: 2,
    type: "avp-prefectura",
    sent_at: new Date().toISOString(),
  });

  await sendEmail({
    to: recipients,
    cc: cc.length > 0 ? cc : undefined,
    bcc: c.author_email ? [c.author_email] : undefined,
    subject,
    text: body,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
    replyTo: `sesizari+${c.code}@civia.ro`,
    from: fromHeader,
  });
}

// ─── STAGE 3: Ziua 60 — Plangere contencios (PDF generat) ────────────────────

async function escalateStage60(
  c: EscalationCandidate,
  admin: ReturnType<typeof createSupabaseAdmin>,
) {
  // Pentru aceasta stage, NU trimitem in numele cetateanului la judecatorie.
  // Doar GENERAM template plangere PDF + trimitem la cetatean cu CTA.
  if (!c.author_email) return; // skip — fara email cetatean

  const fromHeader = buildFromHeader("Civia", "sesizari@civia.ro");
  const subject = `Sesizare ${c.code} — Pașii următori (acțiune contencios administrativ)`;

  const plangereTemplate =
`PLÂNGERE CONTENCIOS ADMINISTRATIV

Către: Tribunalul ${c.county ?? "[județ]"} — Secția Contencios Administrativ și Fiscal

Subsemnatul(a) ${c.author_name ?? "[NUME]"}, cu domiciliul în [ADRESA COMPLETĂ], CNP [CNP],

Formulez prezenta PLÂNGERE împotriva refuzului nejustificat al autorității publice [PRIMĂRIA X] de a soluționa în termen legal sesizarea cu codul ${c.code}, depusă pe ${formatDateRo(c.sent_at!)}.

Temei juridic:
- Legea 554/2004 art. 1 alin. (1) — refuzul nejustificat de a soluționa cerere
- OG 27/2002 art. 8 alin. (1) — termenul de 30 de zile

Motivare:
[descrie pe scurt sesizarea + perioada de tăcere]

Solicit:
1. Obligarea autorității pârâte să soluționeze sesizarea cu codul ${c.code}.
2. Acordarea cheltuielilor de judecată.

Anexez:
- Copie sesizarea depusă (cod ${c.code})
- Dovada trimiterii
- Confirmarea că nu am primit răspuns

Data: [DATĂ]
Semnătura: ${c.author_name ?? "[NUME]"}
`;

  const body =
`Bună ziua, ${c.author_name ?? ""}

Au trecut ${c.days_since_sent} zile de la depunerea sesizării ${c.code} fără răspuns oficial. Civia a parcurs etapele automate:
- Ziua 30: reamintire către primărie cu citarea OG 27/2002 art. 8
- Ziua 45: notificare către Avocatul Poporului + Prefectura județului

Acum, la 60 de zile, pasul recomandat este acțiunea în contencios administrativ (Legea 554/2004). Mai jos găsești un TEMPLATE pe care îl poți folosi pentru a depune plângere la Tribunalul ${c.county ?? "județ"} — Secția Contencios Administrativ.

⚠️ IMPORTANT: Civia NU depune plângerea în numele tău. Trebuie să o completezi tu cu datele lipsă (adresa, CNP), să o semnezi olograf și să o depui la judecătorie. Costul taxa judiciară de timbru este aproximativ 50 RON. Termenul de prescripție este 6 luni de la termenul depășit.

----- TEMPLATE PLÂNGERE -----

${plangereTemplate}

----- SFÂRȘIT TEMPLATE -----

Recomandări:
- Pregătește copia sesizării originale (codul ${c.code} → printează pagina civia.ro/sesizari/${c.code})
- Pregătește dovada trimiterii (capture email send-via-civia)
- Verifică Codul de Procedură Civilă pentru forma cererii

Mulțumesc că folosești Civia. Continuăm să monitorizăm dacă primăria răspunde tardiv.

Cu respect,
Echipa Civia
`;

  await admin.from("sesizare_escalations").insert({
    sesizare_id: c.id,
    stage: 3,
    type: "contencios-template",
    sent_at: new Date().toISOString(),
  });

  await sendEmail({
    to: [c.author_email],
    subject,
    text: body,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
    from: fromHeader,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateRo(iso: string): string {
  const d = new Date(iso);
  const luni = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
  return `${d.getDate()} ${luni[d.getMonth()]} ${d.getFullYear()}`;
}
