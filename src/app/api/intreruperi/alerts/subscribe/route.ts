import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sendEmail, emailTemplate, emailGreeting, escapeEmailHtml } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";

const schema = z.object({
  email: z.string().email().max(200),
  address: z.string().min(5).max(300),
  // 2026-05-27 — honeypot anti-bot
  _honey: z.string().optional().default(""),
});

// Normalizare adresă pentru match-uri parțiale: lowercase, fără diacritice,
// strip extra whitespace + caractere speciale.
function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/ă/g, "a").replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s").replace(/ş/g, "s")
    .replace(/ț/g, "t").replace(/ţ/g, "t")
    .replace(/[^\w\s.-]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

// Detect county code din adresă (foarte simplu: caută menționări București/Cluj/etc).
function detectCounty(addressNormalized: string): { county: string | null; sector: string | null } {
  const a = addressNormalized;
  // București + sector detection
  if (/bucuresti|bucurest|capital/.test(a)) {
    const sectorMatch = a.match(/sector(?:ul)?\s*([1-6])\b/) || a.match(/\bs[ ]?([1-6])\b/);
    return { county: "B", sector: sectorMatch ? `S${sectorMatch[1]}` : null };
  }
  // Other major counties cu match keyword
  const countyMap: Record<string, string> = {
    "cluj": "CJ", "timisoara": "TM", "iasi": "IS", "constanta": "CT",
    "brasov": "BV", "craiova": "DJ", "galati": "GL", "ploiesti": "PH",
    "oradea": "BH", "sibiu": "SB", "arad": "AR", "pitesti": "AG",
    "bacau": "BC", "buzau": "BZ", "voluntari": "IF", "otopeni": "IF",
    "pipera": "IF",
  };
  for (const [kw, code] of Object.entries(countyMap)) {
    if (a.includes(kw)) return { county: code, sector: null };
  }
  return { county: null, sector: null };
}

export async function POST(req: Request) {
  // Rate limit per IP — 5 abonari / oră.
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`intreruperi-alert:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe încercări. Așteaptă 1 oră." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email sau adresă invalidă", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { email, address, _honey } = parsed.data;
  // Honeypot — bots fill, silent-drop with fake success
  if (_honey && _honey.length > 0) {
    return NextResponse.json({ ok: true, note: "received" });
  }
  const normalized = normalizeAddress(address);
  const { county, sector } = detectCounty(normalized);

  const admin = createSupabaseAdmin();

  // Anti-spam: max 5 abonari per email.
  const { count } = await admin
    .from("intreruperi_alerts")
    .select("*", { count: "exact", head: true })
    .eq("email", email.toLowerCase())
    .is("unsubscribed_at", null);
  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Ai deja 5 adrese active. Dezabonează-te de la una pentru a adăuga alta." },
      { status: 400 },
    );
  }

  // Insert (sau update silent dacă există duplicat — onConflict pe unique index).
  const { data: existing } = await admin
    .from("intreruperi_alerts")
    .select("id, confirmed, unsubscribe_token")
    .eq("email", email.toLowerCase())
    .eq("address_normalized", normalized)
    .maybeSingle();

  let row: { id: string; unsubscribe_token: string };
  if (existing) {
    // Re-activate dacă a fost dezabonat anterior + reset confirmation.
    const { data, error } = await admin
      .from("intreruperi_alerts")
      .update({ confirmed: false, unsubscribed_at: null, address_raw: address.slice(0, 300) })
      .eq("id", existing.id)
      .select("id, unsubscribe_token")
      .single();
    if (error) {
      Sentry.captureException(error);
      return NextResponse.json({ error: "Eroare DB" }, { status: 500 });
    }
    row = data;
  } else {
    const { data, error } = await admin
      .from("intreruperi_alerts")
      .insert({
        email: email.toLowerCase(),
        address_raw: address.slice(0, 300),
        address_normalized: normalized,
        county,
        sector,
        confirmed: false,
      })
      .select("id, unsubscribe_token")
      .single();
    if (error) {
      Sentry.captureException(error);
      return NextResponse.json({ error: "Eroare DB" }, { status: 500 });
    }
    row = data;
  }

  // Trimite email cu link de confirmare.
  const confirmUrl = `${SITE_URL}/api/intreruperi/alerts/confirm?token=${row.unsubscribe_token}`;
  const unsubscribeUrl = `${SITE_URL}/api/intreruperi/alerts/unsubscribe?token=${row.unsubscribe_token}`;

  try {
    await sendEmail({
      to: email,
      subject: "Confirmă abonarea la alerte întreruperi · Civia",
      html: emailTemplate({
        title: "Confirmă abonarea",
        preheader: `Adresă monitorizată: ${address}`,
        kicker: "🔔 ALERTE ÎNTRERUPERI",
        icon: "📍",
        body: `${emailGreeting(
          "Salut!",
          `Te-ai înscris pentru alerte automate la întreruperi (apă, curent, gaz, lucrări) pentru adresa <strong>${escapeEmailHtml(address)}</strong>.`,
        )}
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b">
          Apasă butonul de mai jos ca să confirmi abonarea. După confirmare, primești email automat doar când e o întrerupere care îți afectează adresa — nimic mai mult.
        </p>
        <p style="margin:24px 0 8px;font-size:12px;color:#94a3b8">
          Dacă n-ai cerut tu această abonare, ignoră acest email. Record-ul se șterge automat după 48h.
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">
          Te poți dezabona oricând: <a href="${unsubscribeUrl}" style="color:#059669">click aici</a>.
        </p>`,
        ctaText: "Confirmă abonarea",
        ctaUrl: confirmUrl,
      }),
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { kind: "alert_subscribe_email" } });
    // Nu blochez — record-ul există, user poate retrimite.
  }

  return NextResponse.json({
    ok: true,
    message: "Verifică emailul tău pentru link-ul de confirmare.",
  });
}
