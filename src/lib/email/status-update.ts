import { SESIZARE_STATUS_META } from "@/lib/sesizari/status";

/**
 * 2026-06-08 — Email de notificare către cetățean când statusul sesizării sale
 * se schimbă (înregistrată → în lucru → rezolvat etc.). Trimis pe lângă push,
 * fiindcă emailul prinde mai mulți oameni (nu toți au push activat).
 */
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro").replace(/\/$/, "");

const STATUS_MSG: Record<string, string> = {
  inregistrata: "Autoritatea a confirmat înregistrarea sesizării tale și are termen legal de 30 de zile să răspundă (OG 27/2002).",
  "in-lucru": "Autoritatea a luat măsuri și lucrează la sesizarea ta.",
  "actiune-autoritate": "Autoritatea a întreprins acțiuni concrete pe sesizarea ta.",
  rezolvat: "Sesizarea ta a fost marcată ca rezolvată. Verifică în teren și, dacă problema persistă, poți redeschide.",
  redirectionata: "Sesizarea ta a fost redirecționată către autoritatea competentă.",
  respins: "Autoritatea a respins sesizarea ta. Vezi motivul și opțiunile de escaladare.",
};

export function buildStatusUpdateEmail(args: {
  code: string;
  titlu: string | null;
  newStatus: string;
  summary?: string | null;
}): { subject: string; html: string } {
  const meta = SESIZARE_STATUS_META[args.newStatus as keyof typeof SESIZARE_STATUS_META];
  const label = meta?.label ?? args.newStatus;
  const color = meta?.color ?? "#16a34a";
  const url = `${SITE}/sesizari/${args.code}`;
  const subject = `Sesizarea ${args.code} — ${label}`;
  const msg = STATUS_MSG[args.newStatus] ?? "Statusul sesizării tale s-a actualizat.";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const titlu = args.titlu ? esc(args.titlu) : `Sesizarea ${args.code}`;
  const summaryHtml = args.summary
    ? `<tr><td style="padding:0 32px 8px"><div style="background:#f8fafc;border-left:3px solid ${color};border-radius:8px;padding:12px 16px;color:#334155;font-size:14px;line-height:1.5">${esc(args.summary.slice(0, 400))}</div></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="background:linear-gradient(135deg,#0f766e,#16a34a);padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-.02em">Civia</span>
        </td></tr>
        <tr><td style="padding:28px 32px 8px">
          <span style="display:inline-block;background:${color};color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:5px 12px;border-radius:999px">${esc(label)}</span>
          <h1 style="margin:16px 0 6px;font-size:20px;color:#0f172a;line-height:1.3">${titlu}</h1>
          <p style="margin:0;color:#64748b;font-size:13px">Sesizarea <strong>${args.code}</strong></p>
        </td></tr>
        <tr><td style="padding:12px 32px 4px;color:#334155;font-size:15px;line-height:1.6">${msg}</td></tr>
        ${summaryHtml}
        <tr><td style="padding:20px 32px 28px">
          <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:10px">Vezi sesizarea</a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;line-height:1.5">
          Primești acest email pentru că ai depus această sesizare prin Civia. Statusul se actualizează automat când autoritatea răspunde.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}
