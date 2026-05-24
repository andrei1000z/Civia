import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate, emailGreeting, escapeEmailHtml } from "@/lib/email/resend";
import { TYPE_LABELS } from "@/data/intreruperi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";

interface IntrerupereForMatching {
  id: string;
  type: string;
  county: string;
  sector?: string | null;
  addresses: string[];
  reason: string;
  start_at: string;
  end_at: string;
  source_entry_url?: string | null;
  provider: string;
}

interface AlertSubscription {
  id: string;
  email: string;
  address_raw: string;
  address_normalized: string;
  county: string | null;
  sector: string | null;
  unsubscribe_token: string;
  notified_interruption_ids: string[];
}

/**
 * Normalize a raw address string for substring matching. Same logic as
 * subscribe route — lowercase + strip diacritics + only word chars.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ă/g, "a").replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s").replace(/ş/g, "s")
    .replace(/ț/g, "t").replace(/ţ/g, "t")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a list of "anchor tokens" from a subscriber's address: street
 * names, neighborhood names, locality. Filtered to words ≥4 chars (skip
 * "strada", "nr", "bl"). Returns lowercase normalized tokens.
 *
 * Example:
 *   "Strada Iancu Nicolae 23, Pipera, Voluntari"
 *   → ["iancu", "nicolae", "pipera", "voluntari"]
 */
function extractAnchors(addressNormalized: string): string[] {
  const STOPWORDS = new Set([
    "str", "strada", "bd", "bdul", "bulevardul", "blv", "boulevard",
    "calea", "sos", "soseaua", "aleea", "intr", "intrarea", "pta", "piata",
    "nr", "numarul", "bl", "blocul", "sc", "scara", "ap", "apt", "apartamentul",
    "et", "etaj", "judetul", "judet", "jud", "oras", "orasul", "sector",
    "the", "and", "for",
  ]);
  return addressNormalized
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 10); // cap pentru noise
}

/**
 * Check if a subscriber matches an intrerupere.
 * Match criteria (any of):
 *   1. county code identic + sector identic (dacă ambele setate)
 *   2. county code identic + cel puțin un anchor token al subscriber-ului
 *      apare în vreuna din `addresses` ale intreruperii
 */
function matches(sub: AlertSubscription, intr: IntrerupereForMatching): boolean {
  // County guard: dacă subscriber a setat county și diferă, skip.
  if (sub.county && sub.county !== intr.county) return false;

  // Sector match strict pentru București
  if (sub.sector && intr.sector) {
    if (sub.sector !== intr.sector) return false;
  }

  // Anchor token match: cel puțin un cuvânt distinct apare în adresele intr.
  const anchors = extractAnchors(sub.address_normalized);
  if (anchors.length === 0) return false;

  const intrText = intr.addresses
    .map((a) => normalize(a))
    .concat([normalize(intr.reason)])
    .join(" ");

  return anchors.some((a) => intrText.includes(a));
}

/**
 * Find matching subscribers for a batch of intreruperi and send emails.
 *
 * Returns count of emails sent + total matches found (for visibility).
 * Best-effort: erori individuale capture la Sentry, restul continuă.
 *
 * @param intreruperi Lista de intreruperi nou inserate / actualizate
 */
export async function dispatchAlertsForIntreruperi(
  intreruperi: IntrerupereForMatching[],
): Promise<{ sent: number; matched: number; skipped: number }> {
  if (intreruperi.length === 0) return { sent: 0, matched: 0, skipped: 0 };

  const admin = createSupabaseAdmin();

  // Get all unique counties from incoming intreruperi to filter subscribers.
  const counties = [...new Set(intreruperi.map((i) => i.county))];
  if (counties.length === 0) return { sent: 0, matched: 0, skipped: 0 };

  const { data: subs, error } = await admin
    .from("intreruperi_alerts")
    .select("id, email, address_raw, address_normalized, county, sector, unsubscribe_token, notified_interruption_ids")
    .eq("confirmed", true)
    .is("unsubscribed_at", null)
    .or(`county.in.(${counties.join(",")}),county.is.null`);

  if (error) {
    Sentry.captureException(error, { tags: { kind: "alerts_matcher_query" } });
    return { sent: 0, matched: 0, skipped: 0 };
  }

  if (!subs || subs.length === 0) return { sent: 0, matched: 0, skipped: 0 };

  let sent = 0;
  let matched = 0;
  let skipped = 0;

  for (const sub of subs as AlertSubscription[]) {
    const notified = new Set(sub.notified_interruption_ids ?? []);
    const newMatches: IntrerupereForMatching[] = [];

    for (const intr of intreruperi) {
      if (notified.has(intr.id)) {
        skipped += 1;
        continue;
      }
      if (matches(sub, intr)) {
        newMatches.push(intr);
        matched += 1;
      }
    }

    if (newMatches.length === 0) continue;

    // Trimite email cu toate match-urile noi într-un singur batch
    // (un email/abonat/cron-tick — anti-spam).
    try {
      const unsubscribeUrl = `${SITE_URL}/api/intreruperi/alerts/unsubscribe?token=${sub.unsubscribe_token}`;
      const subject = newMatches.length === 1
        ? `🔔 Întrerupere ${TYPE_LABELS[newMatches[0]!.type as keyof typeof TYPE_LABELS] ?? newMatches[0]!.type} pe adresa ta — Civia`
        : `🔔 ${newMatches.length} întreruperi pe adresa ta — Civia`;

      const itemsHtml = newMatches
        .map((m) => {
          const typeLabel = TYPE_LABELS[m.type as keyof typeof TYPE_LABELS] ?? m.type;
          const start = new Date(m.start_at).toLocaleString("ro-RO");
          const end = new Date(m.end_at).toLocaleString("ro-RO");
          const detailUrl = `${SITE_URL}/intreruperi/${m.id}`;
          return `<div style="margin:0 0 18px;padding:14px 16px;background:#f8fafc;border-left:4px solid #f59e0b;border-radius:8px">
  <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#92400e;font-weight:600">${escapeEmailHtml(typeLabel)} · ${escapeEmailHtml(m.provider)}</p>
  <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a">${escapeEmailHtml(m.reason)}</p>
  <p style="margin:0 0 4px;font-size:13px;color:#475569">📅 <strong>${escapeEmailHtml(start)}</strong> → <strong>${escapeEmailHtml(end)}</strong></p>
  <p style="margin:0 0 8px;font-size:13px;color:#475569">📍 ${escapeEmailHtml(m.addresses.slice(0, 3).join(", "))}${m.addresses.length > 3 ? ` (+${m.addresses.length - 3})` : ""}</p>
  <a href="${detailUrl}" style="color:#059669;font-size:13px;font-weight:600">Vezi detalii →</a>
</div>`;
        })
        .join("");

      await sendEmail({
        to: sub.email,
        subject,
        html: emailTemplate({
          title: newMatches.length === 1 ? "Întrerupere pe adresa ta" : `${newMatches.length} întreruperi pe adresa ta`,
          preheader: `Adresă monitorizată: ${sub.address_raw}`,
          kicker: "🔔 ALERTĂ CIVIA",
          icon: "📍",
          body: `${emailGreeting(
            "Salut!",
            `Am detectat <strong>${newMatches.length === 1 ? "o întrerupere" : `${newMatches.length} întreruperi`}</strong> care îți afectează adresa <strong>${escapeEmailHtml(sub.address_raw)}</strong>.`,
          )}
${itemsHtml}
<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center">
  Te poți dezabona oricând: <a href="${unsubscribeUrl}" style="color:#059669">click aici</a>
</p>`,
          ctaText: "Vezi toate întreruperile",
          ctaUrl: `${SITE_URL}/intreruperi`,
        }),
      });

      // Update notified_interruption_ids — append toate ID-urile noi.
      const newIds = [...notified, ...newMatches.map((m) => m.id)];
      await admin
        .from("intreruperi_alerts")
        .update({
          notified_interruption_ids: newIds,
          last_notified_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      sent += 1;
    } catch (e) {
      Sentry.captureException(e, {
        tags: { kind: "alerts_matcher_send" },
        extra: { sub_id: sub.id, matches_count: newMatches.length },
      });
    }
  }

  return { sent, matched, skipped };
}
