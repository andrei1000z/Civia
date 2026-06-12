import { SESIZARE_STATUS_META } from "@/lib/sesizari/status";
import {
  emailTemplate,
  emailGreeting,
  emailStatusPill,
  emailNoteCallout,
  emailPhotoBlock,
  emailBeforeAfter,
  escapeEmailHtml,
} from "./resend";
import { buildSalutation } from "./format";

/**
 * 2026-06-08 — Email de notificare către cetățean când statusul sesizării sale
 * se schimbă (înregistrată → în lucru → rezolvat etc.). Trimis pe lângă push.
 *
 * 2026-06-12 — REFĂCUT: folosește layout-ul partajat `emailTemplate` (înainte
 * avea HTML hand-rolled propriu, divergent de restul emailurilor) + accent
 * SEMANTIC (culoarea statusului în hero/buton — un „Respins" nu mai e verde) +
 * poze (înainte/după la rezolvat, poza raportată la celelalte).
 */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro").replace(/\/$/, "");

/** Mesaj uman, per status — ce înseamnă concret pentru cetățean. */
const STATUS_MSG: Record<string, string> = {
  nou: "Sesizarea ta a fost creată pe Civia.",
  trimis:
    "Sesizarea ta a fost trimisă oficial autorității responsabile. Termenul legal de răspuns este de 30 de zile (OG 27/2002).",
  inregistrata:
    "Autoritatea a confirmat înregistrarea sesizării tale și are termen legal de 30 de zile să răspundă (OG 27/2002). Înregistrarea ≠ rezolvare — urmărim mai departe.",
  redirectionata:
    "Sesizarea ta a fost redirecționată către autoritatea competentă. Termenul de răspuns curge în continuare.",
  "in-lucru": "Vești bune: autoritatea a luat măsuri și lucrează la sesizarea ta.",
  "actiune-autoritate":
    "Autoritatea a întreprins acțiuni concrete pe sesizarea ta — control, sancțiuni sau o intervenție planificată.",
  interventie: "Autoritatea a intervenit în teren pe sesizarea ta.",
  amanata:
    "Autoritatea a amânat rezolvarea, de regulă pentru a o include într-un proiect mai mare. Civia urmărește mai departe.",
  rezolvat:
    "Problema a fost rezolvată. Verifică în teren și, dacă mai persistă ceva, poți redeschide sesizarea cu un click.",
  respins:
    "Autoritatea a respins sesizarea ta. Vezi motivul invocat — dacă ți se pare neîntemeiat, poți escalada la Avocatul Poporului.",
  ignorat:
    "Au trecut peste 60 de zile fără un răspuns pe fond. Ai dreptul să escaladezi la Avocatul Poporului — îți arătăm cum.",
};

export function buildStatusUpdateEmail(args: {
  code: string;
  titlu: string | null;
  newStatus: string;
  /** Sumar/răspuns substanțial al autorității (callout primary). */
  summary?: string | null;
  /** Notă internă (callout muted). */
  note?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  /** Pozele raportate de cetățean (înainte). */
  imagini?: string[] | null;
  /** Pozele primăriei de la rezolvare (după). */
  resolvedPhotos?: string[] | null;
}): { subject: string; html: string } {
  const meta = SESIZARE_STATUS_META[args.newStatus as keyof typeof SESIZARE_STATUS_META];
  const label = meta?.label ?? args.newStatus;
  const color = meta?.color ?? "#059669";
  const emoji = meta?.emoji ?? "📨";
  const url = `${SITE}/sesizari/${args.code}`;
  const isResolved = args.newStatus === "rezolvat";
  const subject = `${emoji} ${label} · Sesizarea ${args.code} · Civia`;
  const salutation = buildSalutation({ fullName: args.authorName ?? null, email: args.authorEmail ?? null });
  const msg = STATUS_MSG[args.newStatus] ?? "Statusul sesizării tale s-a actualizat.";
  const titlu = args.titlu ? escapeEmailHtml(args.titlu) : `Sesizarea ${args.code}`;

  const photos = isResolved
    ? emailBeforeAfter({ before: args.imagini, after: args.resolvedPhotos })
    : args.imagini && args.imagini.length
      ? emailPhotoBlock({ images: args.imagini, label: "Ce ai raportat", max: 2 })
      : "";

  const body = `${emailGreeting(
    salutation,
    `Statusul sesizării tale <strong>${escapeEmailHtml(args.code)}</strong> a fost actualizat.`,
  )}
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:600">Status nou</p>
    <p style="margin:0 0 16px">${emailStatusPill({ label, emoji, color })}</p>
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0f172a;font-weight:600">${titlu}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#334155">${msg}</p>
    ${args.note ? emailNoteCallout({ label: "Notă", text: args.note, tone: "muted" }) : ""}
    ${args.summary ? emailNoteCallout({ label: "Răspunsul autorității", text: args.summary, tone: "primary" }) : ""}
    ${photos}`;

  const html = emailTemplate({
    title: label,
    preheader: args.titlu ?? `Sesizarea ${args.code}`,
    kicker: `STATUS · ${label.toUpperCase()}`,
    icon: emoji,
    accent: color,
    body,
    ctaText: isResolved ? "Vezi rezultatul" : "Vezi sesizarea",
    ctaUrl: url,
  });
  return { subject, html };
}

/**
 * 2026-06-09 (roadmap Faza 0 — celebrarea victoriei) — email festiv către
 * CO-SEMNATARI când o sesizare e rezolvată. „Ai contribuit — problema e gata."
 * 2026-06-12 — refăcut pe `emailTemplate` + poze după (dovada rezolvării).
 */
export function buildVictoryEmail(args: {
  code: string;
  titlu: string | null;
  cosignerName?: string | null;
  cosignerEmail?: string | null;
  imagini?: string[] | null;
  resolvedPhotos?: string[] | null;
}): { subject: string; html: string } {
  const url = `${SITE}/sesizari/${args.code}`;
  const subject = `🎉 Victorie! Sesizarea ${args.code} a fost rezolvată`;
  const salutation = buildSalutation({ fullName: args.cosignerName ?? null, email: args.cosignerEmail ?? null });
  const titlu = args.titlu ? escapeEmailHtml(args.titlu) : `Sesizarea ${args.code}`;
  const photos = emailBeforeAfter({ before: args.imagini, after: args.resolvedPhotos });

  const body = `${emailGreeting(salutation, "O sesizare pe care ai co-semnat-o tocmai a fost rezolvată. 🎉")}
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0f172a;font-weight:600">${titlu}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#334155">
      <strong>Ai contribuit la asta.</strong> Ai co-semnat această sesizare, iar autoritatea a rezolvat-o.
      Vocea ta a contat — împreună ați adus presiunea care a făcut diferența. 💪
    </p>
    ${photos}`;

  const html = emailTemplate({
    title: "Problema a fost rezolvată!",
    preheader: args.titlu ?? `Sesizarea ${args.code} a fost rezolvată`,
    kicker: "VICTORIE CIVICĂ",
    icon: "🎉",
    accent: "#059669",
    body,
    ctaText: "Vezi rezultatul",
    ctaUrl: url,
  });
  return { subject, html };
}
