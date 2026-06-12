import { statusRank } from "../sesizari/state-machine";

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

function row(i: DigestItem, siteUrl: string): string {
  const link = `${siteUrl}/admin/inbox/${i.replyId}`;
  const codeLabel = i.code ? `#${i.code}` : "ORFAN";
  const conf = i.confidence != null ? ` · ${i.confidence}%` : "";
  const date = i.receivedAt ? i.receivedAt.slice(0, 10) : "";
  return `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top">
      <a href="${link}" style="font-weight:700;color:#2563eb;text-decoration:none">${codeLabel}</a>
      <span style="color:#888;font-size:12px"> ${date}</span><br>
      <span style="font-size:13px;color:#111">${escapeHtml(i.motiv)}${conf}</span><br>
      <span style="font-size:12px;color:#555">${escapeHtml(i.summary)}</span><br>
      <span style="font-size:11px;color:#999">${escapeHtml(i.from || "")}</span>
    </td>
  </tr>`;
}

function section(titlu: string, emoji: string, items: DigestItem[], siteUrl: string): string {
  if (!items.length) return "";
  return `<h3 style="margin:18px 0 6px;font-size:15px;color:#111">${emoji} ${titlu} (${items.length})</h3>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden">
    ${items.map((i) => row(i, siteUrl)).join("")}
  </table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

/** Construiește emailul digest. Presupune `totalActionable > 0`. */
export function buildDigestEmail(sections: DigestSections, siteUrl: string): { subject: string; html: string } {
  const subject = `🔔 Civia inbox: ${sections.totalActionable} răspuns${sections.totalActionable === 1 ? "" : "uri"} de procesat`;
  const noiseLine =
    sections.orfaniInregistrareCount > 0
      ? `<p style="font-size:12px;color:#999;margin-top:14px">+ ${sections.orfaniInregistrareCount} confirmări de portal orfane (low-priority, doar de legat când ai timp).</p>`
      : "";
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111">
    <h2 style="font-size:18px;margin:0 0 4px">Răspunsuri de autoritate care așteaptă în coada de revizuire</h2>
    <p style="font-size:13px;color:#555;margin:0 0 8px">
      Astea NU s-au aplicat automat (match incert, orfan, sau status terminal care maschează un răspuns).
      Procesează-le în <a href="${siteUrl}/admin/inbox" style="color:#2563eb">/admin/inbox</a>.
    </p>
    ${section("Răspuns de progres neaplicat", "🟠", sections.progresNeaplicat, siteUrl)}
    ${section("Orfani de legat (răspuns substanțial)", "🔗", sections.orfaniProgres, siteUrl)}
    ${section("OCR eșuat — verifică manual", "📎", sections.ocrEsuat, siteUrl)}
    ${noiseLine}
    <p style="font-size:11px;color:#bbb;margin-top:20px">Civia.ro — digest automat (zilnic, doar când e ceva de făcut). Te re-anunț săptămânal dacă rămâne neprocesat.</p>
  </div>`;
  return { subject, html };
}
