import { emailTemplate, escapeEmailHtml } from "@/lib/email/resend";
import { SITE_URL } from "@/lib/constants";
import type { Authority } from "./authorities";
import type { LegislativeFormalResult } from "./prompts";

/**
 * Email trimis la autoritate — format oficial, Legea 52/2003.
 */
export function buildAuthorityEmail(params: {
  propunereId: string;
  authority: Authority;
  titlu: string;
  formal: LegislativeFormalResult;
  votesCount: number;
  authorName?: string;
}): { subject: string; html: string; text: string } {
  const { authority, titlu, formal, votesCount, authorName, propunereId } = params;
  const publicUrl = `${SITE_URL}/propuneri-legislative/${propunereId}`;
  const e = escapeEmailHtml;

  const subject = `[CIVIA.RO] Propunere legislativă cetățenească — ${formal.titlu_formal} — Legea 52/2003`;

  const body = `
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#0f172a">
  Stimate reprezentant al ${e(authority.name)},
</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155">
  Prin prezenta, platforma civică <strong>Civia.ro</strong> transmite, în conformitate cu
  <strong>Legea nr. 52/2003 privind transparența decizională în administrația publică</strong>,
  o propunere legislativă formulată de cetățeni români și susținută de
  <strong>${votesCount} ${votesCount === 1 ? "cetățean" : "cetățeni"}</strong>.
</p>

<table role="presentation" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:20px 0;padding:24px">
  <tr><td>
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;letter-spacing:0.8px;text-transform:uppercase">TITLUL PROPUNERII</p>
    <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#0f172a">${e(formal.titlu_formal)}</p>

    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;letter-spacing:0.8px;text-transform:uppercase">I. PROBLEMA IDENTIFICATĂ</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#334155">${e(formal.problema_formala)}</p>

    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;letter-spacing:0.8px;text-transform:uppercase">II. SOLUȚIA PROPUSĂ</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#334155">${e(formal.solutia_formala)}</p>

    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;letter-spacing:0.8px;text-transform:uppercase">III. TEMEI LEGAL</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#334155">${e(formal.temei_legal)}</p>

    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;letter-spacing:0.8px;text-transform:uppercase">IV. IMPACT ESTIMAT</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#334155">${e(formal.impact_estimat)}</p>

    ${formal.precedente ? `
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#059669;letter-spacing:0.8px;text-transform:uppercase">V. PRECEDENTE</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#334155">${e(formal.precedente)}</p>
    ` : ""}
  </td></tr>
</table>

<p style="margin:16px 0;font-size:14px;line-height:1.7;color:#334155">
  Propunerea a fost susținută de <strong>${votesCount} cetățeni</strong> pe platforma Civia.ro.
  Textul integral și lista de susținători sunt disponibile la adresa:
  <a href="${publicUrl}" style="color:#059669">${publicUrl}</a>
</p>

${authorName ? `
<p style="margin:8px 0;font-size:14px;color:#64748b">
  Inițiator: ${e(authorName)} (prin platforma Civia.ro)
</p>
` : ""}

<p style="margin:20px 0 8px;font-size:13px;line-height:1.6;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px">
  Această propunere a fost transmisă automat de platforma civică <strong>Civia.ro</strong>
  în baza Legii 52/2003 și OG 27/2002, după atingerea pragului de ${votesCount} susținători cetățeni.
  Vă rugăm să răspundeți în termenul legal de 30 de zile lucrătoare.
</p>`;

  const html = emailTemplate({
    title: formal.titlu_formal,
    preheader: `${votesCount} cetățeni susțin această propunere pentru ${authority.shortName}`,
    kicker: `PROPUNERE LEGISLATIVĂ · ${authority.shortName} · LEGEA 52/2003`,
    icon: authority.icon,
    body,
    ctaText: "Vezi propunerea completă pe Civia.ro",
    ctaUrl: publicUrl,
  });

  const text = [
    `PROPUNERE LEGISLATIVĂ — ${formal.titlu_formal}`,
    `Adresată: ${authority.name}`,
    `Susținători: ${votesCount} cetățeni`,
    "",
    `I. PROBLEMA: ${formal.problema_formala}`,
    `II. SOLUȚIA: ${formal.solutia_formala}`,
    `III. TEMEI LEGAL: ${formal.temei_legal}`,
    `IV. IMPACT: ${formal.impact_estimat}`,
    formal.precedente ? `V. PRECEDENTE: ${formal.precedente}` : "",
    "",
    `Link public: ${publicUrl}`,
    "",
    `Transmisă prin Civia.ro conform Legii 52/2003.`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

/**
 * Email de confirmare trimis propunătorului după submit.
 */
export function buildConfirmationEmail(params: {
  propunereId: string;
  titlu: string;
  destinatarName: string;
  votesThreshold: number;
}): { subject: string; html: string } {
  const { propunereId, titlu, destinatarName, votesThreshold } = params;
  const publicUrl = `${SITE_URL}/propuneri-legislative/${propunereId}`;
  const e = escapeEmailHtml;

  const body = `
<p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">
  Propunerea ta a fost publicată pe Civia.ro și este acum deschisă pentru susținere.
</p>
<p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 16px">
  📋 <strong>${e(titlu)}</strong>
</p>
<p style="font-size:14px;line-height:1.7;color:#64748b;margin:0 0 16px">
  Destinatar: ${e(destinatarName)}<br>
  Prag trimitere automată: <strong>${votesThreshold} susținători</strong>
</p>
<p style="font-size:14px;line-height:1.7;color:#334155;margin:0">
  Când ${votesThreshold} cetățeni o susțin, Civia o trimite automat prin email oficial
  la ${e(destinatarName)} cu referință la Legea 52/2003. Distribuie link-ul
  ca să aduni susțineri mai rapid.
</p>`;

  const html = emailTemplate({
    title: "Propunerea ta a fost publicată",
    preheader: `${votesThreshold} susținători → trimitere automată la ${destinatarName}`,
    icon: "📋",
    body,
    ctaText: "Distribuie propunerea",
    ctaUrl: publicUrl,
  });

  return { subject: `Propunerea ta pe Civia — „${titlu}"`, html };
}
