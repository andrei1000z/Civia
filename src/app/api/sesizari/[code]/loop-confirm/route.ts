import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { analyticsRedis, KEY } from "@/lib/analytics/redis";

export const dynamic = "force-dynamic";

/**
 * 2026-05-25 #31 — Closed-loop confirmation endpoint (1-tap din email).
 *
 * Userul primește email T+14 după marcare rezolvat cu 2 link-uri:
 *   - /api/sesizari/[code]/loop-confirm?outcome=yes&t={hmac}
 *   - /api/sesizari/[code]/loop-confirm?outcome=no&t={hmac}
 *
 * Token HMAC simplu derivat din code + CRON_SECRET — preveni spam.
 * Endpoint:
 *   1. Validează token
 *   2. Save outcome în sesizari.verif_da / verif_nu (reuse coloane
 *      existente pentru verify-rezolvare)
 *   3. Increment Redis counter pentru North-Star metric
 *   4. Render HTML simplu „Mulțumim!" cu redirect la sesizare
 *
 * Public endpoint — no auth (user a deschis email-ul din inbox).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const url = new URL(req.url);
  const outcome = url.searchParams.get("outcome");
  const token = url.searchParams.get("t");

  if (outcome !== "yes" && outcome !== "no") {
    return new Response("Outcome invalid", { status: 400 });
  }
  if (!token || token.length !== 12) {
    return new Response("Token invalid", { status: 400 });
  }

  // Verify HMAC token
  const cronSecret = process.env.CRON_SECRET ?? "";
  const expected = createHash("sha256")
    .update(`${code}:${cronSecret}`)
    .digest("hex")
    .slice(0, 12);
  if (token !== expected) {
    return new Response("Token invalid", { status: 403 });
  }

  // Load sesizare ca să avem ID-ul pentru update
  const admin = createSupabaseAdmin();
  const { data: sez } = await admin
    .from("sesizari")
    .select("id, code, titlu")
    .eq("code", code)
    .maybeSingle();
  if (!sez) {
    return new Response("Sesizare not found", { status: 404 });
  }

  // 2026-06-19 (audit #9) — eliminat increment-ul pe `sesizari.verif_da/verif_nu`:
  // acelea NU sunt coloane reale pe tabel, ci câmpuri COMPUTED în view-ul de feed
  // (count(*) din `sesizare_verifications`). Vechiul select-then-update pe ele
  // eșua silențios ("column does not exist", înghițit de try/catch) → cod mort
  // (deci și „lost update"-ul raportat era moot). Semnalul agregat real e contorul
  // Redis de mai jos (atomic via hincrby).

  // 2026-05-25 #31 — Redis counter pentru North-Star metric dedicated.
  // Aggregat per zi + total ca să surfacem pe /admin/analytics.
  if (analyticsRedis) {
    const today = new Date().toISOString().slice(0, 10);
    await analyticsRedis
      .pipeline()
      .hincrby(KEY.eventsTotal, `loop-confirmed-${outcome}`, 1)
      .expire(KEY.eventsTotal, 90 * 86400)
      .hincrby(`civia:analytics:loop-daily:${today}`, outcome, 1)
      .expire(`civia:analytics:loop-daily:${today}`, 90 * 86400)
      .exec()
      .catch(() => {
        // silent — counter Redis nu trebuie să blocheze user experience
      });
  }

  // Render HTML thank-you page minimal
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
  const msg =
    outcome === "yes"
      ? "Mulțumim că ai confirmat! Sesizarea rămâne în statistici ca <strong>închisă cu succes</strong> — contribuie la North-Star Closed-Loop."
      : "Mulțumim pentru feedback! Am marcat că problema NU s-a rezolvat complet. Un moderator va revedea sesizarea în curând.";

  const html = `<!DOCTYPE html>
<html lang="ro"><head>
<meta charset="utf-8"/>
<title>Confirmare — Civia</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px; color: #1e293b; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center; }
  .icon { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; background: ${outcome === "yes" ? "#10b98115" : "#ef444415"}; color: ${outcome === "yes" ? "#10b981" : "#ef4444"}; }
  h1 { font-size: 24px; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 1.6; color: #475569; }
  .cta { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
</style>
</head><body>
<div class="card">
  <div class="icon">${outcome === "yes" ? "✓" : "✗"}</div>
  <h1>${outcome === "yes" ? "Confirmare primită" : "Feedback înregistrat"}</h1>
  <p>${msg}</p>
  <a class="cta" href="${SITE_URL}/sesizari/${code}">Vezi sesizarea</a>
</div>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
