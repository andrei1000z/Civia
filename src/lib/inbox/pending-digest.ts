import { statusRank } from "../sesizari/state-machine";
import { emailTemplate, emailSectionTitle, emailListCard, emailNoteCallout } from "../email/resend";

/**
 * 2026-06-12 — Digest „coada de inbox neprocesată".
 *
 * Problema (audit 2026-06-12): confirmările de primire se auto-aplică, dar
 * răspunsurile SUBSTANȚIALE (sancțiuni, intervenții, redirect-spre-remediere)
 * nu trec gate-ul de auto-apply (cer match high + autenticitate ≥60) sau vin ca
 * orfani (autoritatea nu păstrează codul Civia) → putrezesc în coada de
 * revizuire pe care nu o procesează nimic. Rezultat: sesizări blocate la
 * „înregistrată" deși autoritatea a acționat.
 *
 * Acest modul = logica PURĂ (testabilă) care decide CE intră în digest și DACĂ
 * se trimite. Endpoint-ul `/api/inbox/pending-digest` (cron zilnic) o folosește.
 */

const PROGRESS = new Set(["rezolvat", "in-lucru", "actiune-autoritate", "interventie", "redirectionata"]);
const TERMINAL_NEGATIV = new Set(["ignorat", "respins"]);

export type DigestReply = {
  id: string;
  sesizare_id: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  from_email: string | null;
  authority_name: string | null;
  subject: string | null;
  received_at: string | null;
  auto_applied: boolean | null;
  user_confirmed: boolean | null;
  attachments?: unknown;
};

export type DigestSesizare = { id: string; code: string; status: string; locatie: string | null };

export type DigestItemKind = "progres-neaplicat" | "orfan-progres" | "ocr-esuat";

export type DigestItem = {
  replyId: string;
  kind: DigestItemKind;
  code: string | null;
  currentStatus: string | null;
  aiStatus: string | null;
  confidence: number | null;
  /** Motiv scurt, citibil: de ce e în digest. */
  motiv: string;
  summary: string;
  from: string | null;
  receivedAt: string | null;
};

export type DigestSections = {
  /** Reply legat de o sesizare, status de progres care AR avansa sesizarea dar nu s-a aplicat. */
  progresNeaplicat: DigestItem[];
  /** Orfan (fără sesizare) cu status de progres — necesită legare manuală. */
  orfaniProgres: DigestItem[];
  /** Reply cu atașament al cărui OCR a eșuat — poate ascunde un verdict. */
  ocrEsuat: DigestItem[];
  /** Orfani „inregistrata" (confirmări de portal nelegate) — doar numărați, low-priority. */
  orfaniInregistrareCount: number;
  /** Suma elementelor ACȚIONABILE (primele trei secțiuni). */
  totalActionable: number;
};

function daysBetween(aMs: number, bIso: string | null): number {
  if (!bIso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(bIso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (aMs - t) / 86_400_000;
}

function attachmentsFailed(attachments: unknown): boolean {
  if (!Array.isArray(attachments)) return false;
  return attachments.some(
    (x) => x && typeof x === "object" && (x as { extraction_method?: string }).extraction_method === "failed",
  );
}

function summarize(r: DigestReply): string {
  return (r.ai_summary || r.subject || "(fără sumar)").slice(0, 160);
}

/**
 * Clasifică replies PENDING (user_confirmed IS NULL) în secțiunile digestului.
 * `sesById` = hartă sesizare_id → {code,status,locatie}. `nowMs` = Date.now()
 * (injectat ca să fie testabil). `maxAgeDays` taie orfanii/eșecurile vechi.
 */
export function categorizePending(
  replies: DigestReply[],
  sesById: Record<string, DigestSesizare>,
  nowMs: number,
  maxAgeDays = 45,
): DigestSections {
  const progresNeaplicat: DigestItem[] = [];
  const orfaniProgres: DigestItem[] = [];
  const ocrEsuat: DigestItem[] = [];
  const inActionable = new Set<string>();
  let orfaniInregistrareCount = 0;

  for (const r of replies) {
    const recent = daysBetween(nowMs, r.received_at) <= maxAgeDays;
    const isProgress = r.ai_status != null && PROGRESS.has(r.ai_status);

    if (r.sesizare_id) {
      const s = sesById[r.sesizare_id];
      if (s && isProgress && !r.auto_applied) {
        const avanseaza = statusRank(r.ai_status!) > statusRank(s.status);
        const mascheazaTerminal = TERMINAL_NEGATIV.has(s.status);
        if (avanseaza || mascheazaTerminal) {
          progresNeaplicat.push({
            replyId: r.id,
            kind: "progres-neaplicat",
            code: s.code,
            currentStatus: s.status,
            aiStatus: r.ai_status,
            confidence: r.ai_confidence,
            motiv: mascheazaTerminal
              ? `Sesizarea e „${s.status}" dar autoritatea a răspuns cu „${r.ai_status}"`
              : `Ar avansa „${s.status}" → „${r.ai_status}", dar nu s-a aplicat automat`,
            summary: summarize(r),
            from: r.from_email,
            receivedAt: r.received_at,
          });
          inActionable.add(r.id);
        }
      }
    } else if (recent && isProgress) {
      orfaniProgres.push({
        replyId: r.id,
        kind: "orfan-progres",
        code: null,
        currentStatus: null,
        aiStatus: r.ai_status,
        confidence: r.ai_confidence,
        motiv: "Orfan (fără sesizare legată) — necesită legare manuală",
        summary: summarize(r),
        from: r.from_email,
        receivedAt: r.received_at,
      });
      inActionable.add(r.id);
    } else if (recent && r.ai_status === "inregistrata" && !r.sesizare_id) {
      orfaniInregistrareCount++;
    }
  }

  // OCR eșuat — scanare separată, fără să dublăm ce e deja acționabil.
  for (const r of replies) {
    if (inActionable.has(r.id)) continue;
    if (daysBetween(nowMs, r.received_at) > maxAgeDays) continue;
    if (!attachmentsFailed(r.attachments)) continue;
    const s = r.sesizare_id ? sesById[r.sesizare_id] : null;
    ocrEsuat.push({
      replyId: r.id,
      kind: "ocr-esuat",
      code: s?.code ?? null,
      currentStatus: s?.status ?? null,
      aiStatus: r.ai_status,
      confidence: r.ai_confidence,
      motiv: "OCR pe atașament a eșuat — verifică manual, poate ascunde un verdict",
      summary: summarize(r),
      from: r.from_email,
      receivedAt: r.received_at,
    });
  }

  const totalActionable = progresNeaplicat.length + orfaniProgres.length + ocrEsuat.length;
  return { progresNeaplicat, orfaniProgres, ocrEsuat, orfaniInregistrareCount, totalActionable };
}

/** Semnătură deterministă a setului acționabil (id-uri sortate) — pt. throttle. */
export function digestSignature(sections: DigestSections): string {
  const ids = [
    ...sections.progresNeaplicat,
    ...sections.orfaniProgres,
    ...sections.ocrEsuat,
  ]
    .map((i) => i.replyId)
    .sort();
  return ids.join(",");
}

export const DIGEST_REMINDER_MS = 7 * 86_400_000; // re-nag săptămânal dacă rămâne neprocesat

/**
 * Decide dacă trimitem. Trimite când există elemente acționabile ȘI fie setul
 * S-A SCHIMBAT față de ultimul digest (a apărut ceva nou), fie au trecut ≥7
 * zile de la ultimul (re-reminder pt. coada neprocesată). Niciodată pe coadă
 * goală (zero spam când totul e curat).
 */
export function shouldSendDigest(args: {
  totalActionable: number;
  signature: string;
  lastSignature: string | null;
  lastSentAtMs: number | null;
  nowMs: number;
}): boolean {
  if (args.totalActionable === 0) return false;
  if (args.lastSignature !== args.signature) return true;
  if (args.lastSentAtMs == null) return true;
  return args.nowMs - args.lastSentAtMs >= DIGEST_REMINDER_MS;
}

/** Badge semantic per tip de element — culoarea spune dintr-o privire ce fel de muncă e. */
const KIND_BADGE: Record<DigestItemKind, { label: string; color: string }> = {
  "progres-neaplicat": { label: "Progres", color: "#F59E0B" },
  "orfan-progres": { label: "Orfan", color: "#0EA5E9" },
  "ocr-esuat": { label: "OCR", color: "#6B7280" },
};

/** Un element de digest → rând de emailListCard (escaparea o face emailListCard). */
function listItem(i: DigestItem, siteUrl: string) {
  const badge = KIND_BADGE[i.kind];
  const date = i.receivedAt ? i.receivedAt.slice(0, 10) : null;
  const conf = i.confidence != null ? `${i.confidence}% încredere` : null;
  const meta = [i.summary, i.from, date, conf].filter(Boolean).join(" · ");
  return {
    title: `${i.code ? `#${i.code}` : "ORFAN"} — ${i.motiv}`,
    meta,
    url: `${siteUrl}/admin/inbox/${i.replyId}`,
    badge: badge.label,
    badgeColor: badge.color,
  };
}

function sectionBlock(titlu: string, items: DigestItem[], siteUrl: string): string {
  if (!items.length) return "";
  return emailSectionTitle(`${titlu} (${items.length})`) + emailListCard(items.map((i) => listItem(i, siteUrl)));
}

/** Construiește emailul digest. Presupune `totalActionable > 0`. */
export function buildDigestEmail(sections: DigestSections, siteUrl: string): { subject: string; html: string } {
  const n = sections.totalActionable;
  const plural = n === 1 ? "răspuns" : "răspunsuri";
  const subject = `🔔 Civia inbox: ${n} ${plural} de procesat`;

  const intro = `<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#424245">Autoritățile au răspuns, dar ${n === 1 ? "un răspuns așteaptă" : `${n} răspunsuri așteaptă`} în coada de revizuire — nu s-au aplicat automat (match incert, orfan sau status terminal care maschează un răspuns).</p>
<p style="margin:0 0 8px;font-size:13.5px;line-height:1.6;color:#86868b">Apasă pe orice element ca să-l deschizi direct în inboxul admin.</p>`;

  const noise =
    sections.orfaniInregistrareCount > 0
      ? emailNoteCallout({
          label: "Zgomot de fundal",
          text: `+ ${sections.orfaniInregistrareCount} confirmări de portal orfane — low-priority, de legat când ai timp.`,
          tone: "muted",
        })
      : "";

  const cadence = `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#a1a1a6">Digest automat — vine zilnic doar când e ceva de procesat și revine săptămânal dacă coada rămâne neatinsă.</p>`;

  const body = [
    intro,
    sectionBlock("Răspunsuri de progres neaplicate", sections.progresNeaplicat, siteUrl),
    sectionBlock("Orfani de legat — răspuns substanțial", sections.orfaniProgres, siteUrl),
    sectionBlock("OCR eșuat — verifică manual", sections.ocrEsuat, siteUrl),
    noise,
    cadence,
  ].join("");

  const html = emailTemplate({
    title: "Coada de inbox",
    preheader: `${n} ${plural} de autoritate de procesat în coada de revizuire`,
    kicker: "ADMIN · INBOX",
    icon: "🔔",
    accent: "#F59E0B",
    body,
    ctaText: "Deschide inboxul admin",
    ctaUrl: `${siteUrl}/admin/inbox`,
  });
  return { subject, html };
}
