/**
 * SMS send abstraction — Twilio-first, graceful no-op fallback.
 *
 * Required env vars (when configured):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_PHONE  — sender number (E.164 format, e.g. „+40712345678")
 *
 * Fără env vars → returnează { ok: false, reason: "not-configured" } și
 * loghează la consolă. Civia rulează fără SMS până când admin adaugă
 * cheile Twilio în Vercel env vars.
 *
 * Pe Twilio Trial (cont gratuit, $15 credit): poți trimite SMS doar la
 * numerele verificate. Plan paid: orice număr RO ~$0.04/SMS. Pentru
 * ~1000 subscribers × 1 SMS/săpt = ~$40/lună.
 */

interface SmsResult {
  ok: boolean;
  reason?: string;
  providerMessageId?: string;
}

interface SmsArgs {
  to: string; // E.164 format preferred ("+40712345678")
  body: string; // max 160 chars per SMS standard; mai mult se sparge în multi-part
}

function isConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_PHONE,
  );
}

/**
 * Normalizează numărul RO la format E.164 dacă lipsește prefix.
 * „0712345678" → „+40712345678"
 * „+40712345678" → neschimbat
 * Orice altceva → întoarce original (Twilio va valida).
 */
function normalizePhoneRO(phone: string): string {
  const trimmed = phone.trim().replace(/[\s\-()]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+40${trimmed.slice(1)}`;
  return trimmed;
}

export async function sendSms({ to, body }: SmsArgs): Promise<SmsResult> {
  if (!isConfigured()) {
    console.warn(`[sms] not configured — would send to ${to}: ${body.slice(0, 80)}…`);
    return { ok: false, reason: "not-configured" };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_PHONE!;
  const normalizedTo = normalizePhoneRO(to);

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({
      From: from,
      To: normalizedTo,
      Body: body.slice(0, 1600), // cap defensiv (10 SMS multi-part max)
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[sms] Twilio ${res.status}: ${errText.slice(0, 200)}`);
      return { ok: false, reason: `twilio-${res.status}` };
    }

    const j = (await res.json()) as { sid?: string };
    return { ok: true, providerMessageId: j.sid };
  } catch (e) {
    console.warn("[sms] send failed:", e instanceof Error ? e.message : "unknown");
    return { ok: false, reason: "fetch-failed" };
  }
}

/**
 * Trimite SMS la o listă de numere. Returnează stats — best-effort, nu
 * face throw dacă unele eșuează (continuă cu următoarele).
 */
export async function sendSmsBatch(
  recipients: Array<{ phone: string }>,
  body: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!isConfigured()) {
    console.warn(`[sms] batch skipped (not configured) — ${recipients.length} pending`);
    return { sent: 0, failed: 0, skipped: recipients.length };
  }
  let sent = 0;
  let failed = 0;
  // Serial loop, nu paralel — Twilio rate-limit-uri 1 SMS/sec implicit.
  for (const r of recipients) {
    if (!r.phone || r.phone.trim().length < 6) {
      failed += 1;
      continue;
    }
    const res = await sendSms({ to: r.phone, body });
    if (res.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed, skipped: 0 };
}

export function isSmsConfigured(): boolean {
  return isConfigured();
}
