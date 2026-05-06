import { NextResponse } from "next/server";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { stripPrivateAddress } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/**
 * GET /api/sesizari/[code]/pdf — returns an HTML document formatted
 * for print as PDF (user clicks Print → Save as PDF in browser).
 * No heavy PDF lib needed — the browser handles rendering.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = await rateLimitAsync(`pdf:${getClientIp(req)}`, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri PDF" }, { status: 429 });
  }

  const { code } = await params;
  const sesizare = await getSesizareByCode(code);
  if (!sesizare) {
    return NextResponse.json({ error: "Sesizare inexistentă" }, { status: 404 });
  }

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<title>Sesizare ${sesizare.code} — Civia</title>
<style>
  @page { margin: 2cm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; font-size: 12pt; line-height: 1.8; color: #111; }
  .header { text-align: center; border-bottom: 2px solid #1C4ED8; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 18pt; color: #1C4ED8; margin-bottom: 4px; }
  .header p { font-size: 10pt; color: #666; }
  .meta { display: flex; justify-content: space-between; font-size: 10pt; color: #555; margin-bottom: 20px; border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
  .meta div { display: flex; flex-direction: column; gap: 4px; }
  .meta strong { color: #111; }
  .body { white-space: pre-wrap; margin-bottom: 24px; }
  .body p { margin-bottom: 12px; text-indent: 2em; text-align: justify; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 9pt; color: #888; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: bold; }
  .badge-status { background: #dbeafe; color: #1e40af; }
  .badge-sector { background: #f1f5f9; color: #475569; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <h1>CIVIA — Platforma Civică a României</h1>
  <p>Sesizare formală generată automat · civia.ro</p>
</div>

<div class="meta">
  <div>
    <span><strong>Cod:</strong> ${sesizare.code}</span>
    <span><strong>Data:</strong> ${new Date(sesizare.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}</span>
    <span><strong>Autor:</strong> ${sesizare.author_name}</span>
  </div>
  <div>
    <span><strong>Tip:</strong> ${sesizare.tip}</span>
    <span><strong>Sector:</strong> ${sesizare.sector}</span>
    <span><strong>Status:</strong> <span class="badge badge-status">${sesizare.status.toUpperCase()}</span></span>
  </div>
</div>

<h2 style="font-size:14pt;margin-bottom:8px">${sesizare.titlu}</h2>
<p style="font-size:10pt;color:#666;margin-bottom:16px">📍 ${sesizare.locatie}</p>

${sesizare.formal_text
  ? (() => {
      // Defense-in-depth scrub: getSesizareByCode already redacts for
      // non-owners, but apply stripPrivateAddress anyway as backup so
      // the printed PDF can't leak even on a cache or fetch regression.
      const scrubbed = stripPrivateAddress(sesizare.formal_text, sesizare.author_name);
      return `<div class="body">${scrubbed.split("\n\n").map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
    })()
  : `<div class="body"><p>${sesizare.descriere}</p></div>`
}

${sesizare.imagini.length > 0 ? `
<p style="font-size:10pt;color:#555;margin-bottom:8px"><strong>Fotografii atașate:</strong></p>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px">
  ${sesizare.imagini.map((url: string, i: number) => `<img src="${url}" alt="Fotografie sesizare ${i + 1}" style="max-width:200px;max-height:150px;border:1px solid #ddd;border-radius:4px" />`).join("")}
</div>` : ""}

<div class="footer">
  <p>Document generat de civia.ro · ${new Date().toLocaleDateString("ro-RO")} · Cod sesizare: ${sesizare.code}</p>
  <p>Conținutul acestui document poate fi folosit ca dovadă a sesizării depuse.</p>
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
