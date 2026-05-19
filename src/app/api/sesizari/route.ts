import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { listSesizari, createSesizare } from "@/lib/sesizari/repository";
import { generateUniqueCode } from "@/lib/sesizari/codes";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp, identityKey } from "@/lib/ratelimit";
import { sanitizeText, escapeHtml } from "@/lib/sanitize";
import { humanizeSupabaseError } from "@/lib/supabase/errors";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { buildSalutation, formatRecipientName } from "@/lib/email/format";
import { invalidateSesizariCache } from "@/lib/cached-queries";
import { polishSesizare } from "@/lib/sesizari/polish";
import { objectifyFormalText } from "@/lib/sesizari/objectify";
import { reformatFormalText } from "@/lib/sesizari/format-paragraphs";
import { removeMinimization } from "@/lib/sesizari/anti-minimization";
import { forwardGeocode } from "@/lib/sesizari/geocoding";
import { sendPushToUsers } from "@/lib/push/web-push-client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SESIZARE_TIPURI } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Single source of truth: SESIZARE_TIPURI din src/lib/constants.ts.
type Tip = (typeof SESIZARE_TIPURI)[number]["value"];
const VALID_TIPURI = SESIZARE_TIPURI.map((t) => t.value) as readonly Tip[] as [Tip, ...Tip[]];

// Lenient validation: accept empty strings for optional fields
const createSchema = z.object({
  author_name: z.string().min(2, "Numele trebuie să aibă minim 2 caractere").max(120),
  author_email: z.union([z.string().email(), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v)),
  tip: z.enum(VALID_TIPURI),
  titlu: z.string().min(3, "Titlul trebuie să aibă minim 3 caractere").max(200),
  locatie: z.string().min(3, "Locația trebuie să aibă minim 3 caractere").max(300),
  sector: z.enum(["S1", "S2", "S3", "S4", "S5", "S6"]).optional().nullable().default(null),
  county: z.string().max(3).optional().nullable(),       // "CJ", "B", etc.
  locality: z.string().max(100).optional().nullable(),    // "Cluj-Napoca", etc.
  lat: z.number().min(43.5).max(48.3),  // Romania lat range (actual)
  lng: z.number().min(20.2).max(29.7),  // Romania lng range (actual)
  descriere: z.string().min(10, "Descrierea trebuie să aibă minim 10 caractere").max(2000),
  formal_text: z.string().max(5000).optional().nullable(),
  // AI auto-generated category cand tip="altele". Admin vede grupari.
  custom_category: z.string().max(50).optional().nullable(),
  custom_category_confidence: z.number().int().min(0).max(100).optional().nullable(),
  imagini: z.array(z.string().url()).max(5).default([]),
  publica: z.boolean().default(true),
  // Honeypot: bots fill all fields, humans don't see this.
  // Accept any value here (mobile autofill sometimes fills it) — we check manually below.
  _honey: z.string().optional().default(""),
});

// Great-circle distance in km between two WGS84 points. Used to detect
// "the user's GPS was clearly wrong" at sesizare creation time — if parsed
// coords are >20 km from a Nominatim forward-geocode of their text, we
// trust the text.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    const rows = await listSesizari({
      tip: searchParams.get("tip") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sector: searchParams.get("sector") ?? undefined,
      county: searchParams.get("county") ?? undefined,
      sort: (searchParams.get("sort") as "recent" | "votate") ?? "recent",
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return NextResponse.json(
      { data: rows },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // User-aware rate-limit: utilizator logat NU poate ocoli prin rotire IP.
  const supabase = await createSupabaseServer();
  const { data: { user: rlUser } } = await supabase.auth.getUser();
  const rlKey = `sesizari-create:${identityKey(rlUser?.id ?? null, ip)}`;
  const rl = await rateLimitAsync(rlKey, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe sesizări create. Încearcă în 10 min." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    // Honeypot: if filled, silent drop with fake success — the bot thinks it worked,
    // we don't pollute the DB, and real users who hit this via mobile autofill also get a 200.
    //
    // Severity heuristic: short/empty titlu+descriere with the honeypot
    // filled = almost certainly a bot → log at `info` (noise tolerant).
    // Long content with the honeypot filled = almost certainly a real
    // user whose mobile autofill leaked the address-bar URL into the
    // hidden „website" field → log at `warning` so we can investigate
    // the false positive. Either way the response is identical: bots
    // think it worked, real users get the same fake success and find
    // their /urmareste 404 (which surfaces a "verifică codul" prompt).
    if (parsed._honey && parsed._honey.length > 0) {
      const looksLikeBot =
        (parsed.titlu?.length ?? 0) < 5 && (parsed.descriere?.length ?? 0) < 20;
      Sentry.captureMessage("honeypot triggered on /api/sesizari POST", {
        level: looksLikeBot ? "info" : "warning",
        tags: { kind: "honeypot", classification: looksLikeBot ? "bot" : "false_positive" },
        extra: {
          honey_value: parsed._honey.slice(0, 200),
          ip_hash: getClientIp(req).slice(0, 8) + "…",
          user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? "",
          titlu_len: parsed.titlu?.length ?? 0,
          descriere_len: parsed.descriere?.length ?? 0,
        },
      });
      return NextResponse.json({ data: { code: "XXXXXX", titlu: parsed.titlu } });
    }

    const user = rlUser; // already resolved at rate-limit time

    const code = await generateUniqueCode();

    // Polish title + descriere + locatie via AI before saving. User input
    // is often ALL CAPS, imperative and without diacritics — not something
    // we want as the public face of the sesizare. Fast model, ~200ms.
    //
    // Best-effort: dacă Groq pică (rate limit, timeout, key invalid),
    // folosim textul original sanitizat. NU vrem ca utilizatorul să piardă
    // sesizarea pentru că AI-ul a hâcâit. Sentry capturează ca să detectăm
    // pattern de eșuări.
    const safeTitlu = sanitizeText(parsed.titlu, 200);
    const safeDescriere = sanitizeText(parsed.descriere, 2000);
    const safeLocatie = sanitizeText(parsed.locatie, 300);
    let polished = { titlu: safeTitlu, descriere: safeDescriere, locatie: safeLocatie };
    try {
      polished = await polishSesizare({
        titlu: safeTitlu,
        descriere: safeDescriere,
        locatie: safeLocatie,
        tip: parsed.tip,
      });
    } catch (polishErr) {
      Sentry.captureException(polishErr, { tags: { kind: "polish_failed" }, extra: { code } });
      // polished e deja inițializat cu textul sanitizat raw — sesizarea pleacă
    }

    // If the submitted lat/lng doesn't match the polished location text,
    // replace it with the forward-geocode result. Most users type the
    // sesizare on their couch, so the submitted coord is their HOME,
    // not the problem spot — we pick up on that by comparing the
    // geocoded address of the problem ("Calea Griviței 234") with the
    // coords the browser sent.
    //
    // Threshold is intentionally tight (1.5 km). Bigger means "user's
    // GPS was probably accurate, don't second-guess"; smaller means "we
    // don't trust browser-reported coords when the text is specific".
    // A street-level geocode hit is usually < 50 m off; anything past
    // 1.5 km is noise.
    let finalLat = parsed.lat;
    let finalLng = parsed.lng;
    try {
      // County code → name so the geocode extractor's fallback queries
      // land in the right city.
      const { getCountyById } = await import("@/data/counties");
      const countyName = parsed.county ? (getCountyById(parsed.county)?.name ?? null) : null;
      const hit = await forwardGeocode(polished.locatie, countyName);
      if (hit) {
        const distKm = haversineKm(parsed.lat, parsed.lng, hit.lat, hit.lng);
        if (distKm > 1.5) {
          finalLat = hit.lat;
          finalLng = hit.lng;
        }
      }
    } catch { /* silent — keep original coords */ }

    // Defense-in-depth: sanitize formal_text de claims subjective inainte
    // de save (cazul cand AI improve dintr-o sesiune veche n-a aplicat
    // objectify, sau cand user a editat manual textul cu „in dreptul
    // domiciliu meu"). Sterge expresii relativiste ca textul sa poata fi
    // reutilizat de co-semnatari fara probleme.
    // Defense-in-depth pipeline pe formal_text inainte de save:
    //  1. objectifyFormalText — sterge claims subjective („domiciliul meu")
    //  2. removeMinimization — sterge fraze care submineaza sesizarea
    //     („pietonilor li se asigura inca suficient spatiu") — BUG critic
    //     raportat 5/19/2026, AI inversa logica complet.
    //  3. reformatFormalText — paragrafe corecte
    const safeFormalText = parsed.formal_text
      ? reformatFormalText(
          removeMinimization(
            objectifyFormalText(parsed.formal_text, {
              locatie: polished.locatie,
              adresaCetatean: null,
            }).text,
          ).text,
        )
      : parsed.formal_text;

    // Calculeaza author_display_name pentru render public.
    // Daca user logat: ia display_name din profile (Google sign-in il
    // umple cu prenume). Altfel, primul cuvant din author_name (privacy).
    let authorDisplayName: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      authorDisplayName = profile?.display_name?.trim() || null;
    }
    if (!authorDisplayName) {
      const firstWord = parsed.author_name.trim().split(/\s+/)[0]?.trim();
      authorDisplayName = firstWord || null;
    }

    try {
      const row = await createSesizare({
        code,
        user_id: user?.id ?? null,
        ...parsed,
        formal_text: safeFormalText,
        author_name: sanitizeText(parsed.author_name, 120),
        author_display_name: authorDisplayName,
        titlu: polished.titlu,
        locatie: polished.locatie,
        descriere: polished.descriere,
        lat: finalLat,
        lng: finalLng,
      });

      // Bust stats cache so /impact, LiveStatsBar, /api/v1/stats see the new
      // sesizare immediately instead of waiting up to 5 min for the TTL.
      invalidateSesizariCache();

      // 2026-05-18: scos „adopt-a-street" feature complet. Notificarile
      // catre followeri pe sesizare/judet raman prin sesizare_follows
      // (urmariri explicite pe sesizare specifica).

      // Send confirmation email (non-blocking — don't delay response)
      const authorEmail = parsed.author_email;
      if (authorEmail) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
        // Use the polished salutation helper so a missing /
        // placeholder / email-local-part name falls through to a
        // clean „Bună!" instead of „Salut, Cetățean 👋".
        const cleanFirstName = formatRecipientName({
          fullName: parsed.author_name,
          email: authorEmail,
        });
        const salutation = cleanFirstName
          ? `Salut, ${cleanFirstName} 👋`
          : buildSalutation({ withEmoji: true });
        const cleanTitle = sanitizeText(parsed.titlu, 120);
        const cleanLocation = sanitizeText(parsed.locatie, 120);
        sendEmail({
          to: authorEmail,
          subject: `✓ Sesizare ${code} înregistrată — Civia`,
          html: emailTemplate({
            title: "Sesizarea ta e în sistem",
            kicker: "Sesizare înregistrată",
            icon: "✓",
            preheader: `Codul tău de urmărire: ${code}. Răspunsul oficial vine în max 30 de zile.`,
            body: `
              <p style="font-size:16px;margin:0 0 8px;font-weight:600;color:#0f172a">${escapeHtml(salutation)}</p>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6">Mulțumim că te implici. Am înregistrat-o — iată ce urmează.</p>

              <!-- Cod unic — hero element -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:1px solid #a7f3d0;border-radius:14px;padding:24px;margin:0 0 20px">
                <tr><td align="center">
                  <p style="color:#047857;font-size:11px;margin:0 0 8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Codul tău de urmărire</p>
                  <p style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:42px;font-weight:800;color:#064e3b;margin:0;letter-spacing:4px;line-height:1">${escapeHtml(code)}</p>
                  <p style="color:#059669;font-size:12px;margin:10px 0 0">Salvează-l — îți trebuie pentru urmărire</p>
                </td></tr>
              </table>

              <!-- Metadata rows -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:0 0 24px">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;width:32%;vertical-align:top">Titlu</td>
                  <td style="padding:14px 18px 14px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;line-height:1.5">${escapeHtml(cleanTitle)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:12px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;vertical-align:top">Locație</td>
                  <td style="padding:14px 18px 14px 0;font-size:14px;color:#0f172a;line-height:1.5">📍 ${escapeHtml(cleanLocation)}</td>
                </tr>
              </table>

              <!-- What happens next — 3-step timeline -->
              <p style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 14px">Ce urmează:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">
                <tr>
                  <td style="width:28px;vertical-align:top;padding:2px 0">
                    <div style="width:22px;height:22px;border-radius:50%;background:#059669;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:22px">✓</div>
                  </td>
                  <td style="padding:0 0 16px 12px;font-size:13px;line-height:1.5;color:#334155">
                    <strong style="color:#0f172a">Înregistrată pe Civia</strong><br>
                    <span style="color:#64748b">Acum — vizibilă la <a href="${siteUrl}/sesizari/${code}" style="color:#059669;text-decoration:none">/sesizari/${escapeHtml(code)}</a></span>
                  </td>
                </tr>
                <tr>
                  <td style="width:28px;vertical-align:top;padding:2px 0">
                    <div style="width:22px;height:22px;border-radius:50%;background:#f1f5f9;border:2px solid #cbd5e1;color:#64748b;font-size:12px;font-weight:700;text-align:center;line-height:18px">2</div>
                  </td>
                  <td style="padding:0 0 16px 12px;font-size:13px;line-height:1.5;color:#334155">
                    <strong style="color:#0f172a">Trimisă la autoritate</strong><br>
                    <span style="color:#64748b">Când apeși „Deschide în Gmail/Outlook" — emailul pleacă în numele tău la instituția corectă</span>
                  </td>
                </tr>
                <tr>
                  <td style="width:28px;vertical-align:top;padding:2px 0">
                    <div style="width:22px;height:22px;border-radius:50%;background:#f1f5f9;border:2px solid #cbd5e1;color:#64748b;font-size:12px;font-weight:700;text-align:center;line-height:18px">3</div>
                  </td>
                  <td style="padding:0 0 4px 12px;font-size:13px;line-height:1.5;color:#334155">
                    <strong style="color:#0f172a">Răspuns oficial</strong><br>
                    <span style="color:#64748b">Max 30 de zile (OG 27/2002). Te notificăm când apare un update.</span>
                  </td>
                </tr>
              </table>
            `,
            ctaText: "Deschide sesizarea",
            ctaUrl: `${siteUrl}/sesizari/${code}`,
          }),
        }).catch((err) => {
          // fire-and-forget, but report to Sentry so we know if Resend breaks
          Sentry.captureException(err, { tags: { kind: "sesizare_email" }, extra: { code } });
        });
      }

      return NextResponse.json({ data: row });
    } catch (dbErr) {
      const human = humanizeSupabaseError(dbErr);
      return NextResponse.json({ error: human.message }, { status: human.status });
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      // Human-readable error for the first issue
      const firstIssue = e.issues[0];
      const friendly = firstIssue?.message ?? "Date invalide";
      const field = firstIssue?.path.join(".");
      return NextResponse.json(
        { error: `${friendly}${field ? ` (${field})` : ""}`, details: e.issues },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
