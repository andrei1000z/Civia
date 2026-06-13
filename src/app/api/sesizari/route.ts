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
import { isPlaceholderTitlu, deriveTitluFromDescriere } from "@/lib/sesizari/titlu";
import { generateTitlu } from "@/lib/sesizari/reformulate-descriere";
import { objectifyFormalText } from "@/lib/sesizari/objectify";
import { reformatFormalText } from "@/lib/sesizari/format-paragraphs";
import { removeMinimization } from "@/lib/sesizari/anti-minimization";
import { forwardGeocode, countyCentroid } from "@/lib/sesizari/geocoding";
import { ROMANIA_CENTER } from "@/lib/constants";
import { encryptField } from "@/lib/crypto/field";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SESIZARE_TIPURI } from "@/lib/constants";

export const dynamic = "force-dynamic";
// 2026-06-05 — 60s: ruta face polish AI (cu fallback Gemini, mai lent când Groq
// e 429) + forward/reverse geocode (Nominatim). Fără maxDuration explicit,
// default-ul mic ducea la TIMEOUT → Vercel întorcea „An error occurred" (non-JSON)
// → clientul nu-l putea parsa („Unexpected token A").
export const maxDuration = 60;

// Single source of truth: SESIZARE_TIPURI din src/lib/constants.ts.
type Tip = (typeof SESIZARE_TIPURI)[number]["value"];
const VALID_TIPURI = SESIZARE_TIPURI.map((t) => t.value) as readonly Tip[] as [Tip, ...Tip[]];

// Lenient validation: accept empty strings for optional fields
const createSchema = z.object({
  author_name: z.string().min(2, "Numele trebuie să aibă minim 2 caractere").max(120),
  author_email: z.union([z.string().email(), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v)),
  // Adresa cetățeanului — stocată ca să o putem afișa în textul formal
  // („Mă numesc X, locuiesc în Y") și să nu o pierdem la re-generare.
  author_address: z.union([z.string().max(300), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v ?? null)),
  tip: z.enum(VALID_TIPURI),
  titlu: z.string().min(3, "Titlul trebuie să aibă minim 3 caractere").max(200),
  locatie: z.string().min(3, "Locația trebuie să aibă minim 3 caractere").max(300),
  sector: z.enum(["S1", "S2", "S3", "S4", "S5", "S6"]).optional().nullable().default(null),
  county: z.string().max(3).optional().nullable(),       // "CJ", "B", etc.
  locality: z.string().max(100).optional().nullable(),    // "Cluj-Napoca", etc.
  // 2026-05-29 — lat/lng OPTIONAL + nullable. Inainte erau obligatorii ->
  // userii fara geolocation primeau Zod 400 cu „Unexpected token 'A'..." in
  // browser cand JSON parse esua. Acum: daca lipsesc, forward-geocode din
  // locatie text (acelasi flow ca finalLat/finalLng logic mai jos). Doar
  // daca AND geocode esueaza, returnam 400 friendly.
  lat: z.number().min(43.5).max(48.3).optional().nullable(),
  lng: z.number().min(20.2).max(29.7).optional().nullable(),
  descriere: z.string().min(10, "Descrierea trebuie să aibă minim 10 caractere").max(2000),
  formal_text: z.string().max(5000).optional().nullable(),
  // 2026-06-14 — true când userul a EDITAT manual textul oficial în formular.
  // Atunci NU regenerăm din template server-side (i-am pierde editările) — îl
  // onorăm verbatim, doar prin pipeline-ul de siguranță (objectify/anti-minim.).
  formal_text_edited: z.boolean().optional(),
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
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
      // ?fields=map → coloane minime pentru pin-urile de pe hartă (audit #20).
      fields: searchParams.get("fields") === "map" ? "map" : undefined,
    });
    // 2026-05-25 OPTIMIZATION: s-maxage 30→120 (2 min). Feed-ul public
    // schimbă rar; CDN cache hits reduce edge requests cu ~50%.
    return NextResponse.json(
      { data: rows },
      {
        headers: {
          // 2026-05-27 — 3-layer pe Vercel: fără CDN-Cache-Control, edge-ul
          // strips s-maxage înainte de browser. Per Vercel docs.
          "Cache-Control": "max-age=10",
          "CDN-Cache-Control": "max-age=120",
          "Vercel-CDN-Cache-Control": "max-age=300",
        },
      }
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

    // 2026-05-26 — Content moderation (raportat de dkrandu pe Reddit).
    // Civia trimite acum server-side via Resend de la sesizari@civia.ro,
    // așa că dacă cineva ar pune o amenințare în câmpul nume sau în
    // descriere, ar ajunge la primărie cu reputația civia.ro. Blocăm
    // amenințările clare + profanity în nume ÎNAINTE de generare cod +
    // INSERT în DB.
    const { moderateSesizareContent } = await import("@/lib/sesizari/content-moderation");
    const mod = moderateSesizareContent({
      author_name: parsed.author_name,
      titlu: parsed.titlu,
      descriere: parsed.descriere,
      locatie: parsed.locatie,
    });
    if (mod.block) {
      Sentry.captureMessage("content moderation blocked sesizare submission", {
        level: "warning",
        tags: { kind: "content_moderation_block", reason: mod.reason },
        extra: {
          ip_hash: getClientIp(req).slice(0, 8) + "…",
          matched: mod.matched ?? [],
          author_name_len: parsed.author_name.length,
          descriere_len: parsed.descriere.length,
        },
      });
      return NextResponse.json(
        {
          error: `Sesizarea nu poate fi trimisă: ${mod.reason}. Sesizările prin Civia trec către primării în numele tău — limbajul ofensator sau amenințător nu este permis.`,
        },
        { status: 400 },
      );
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

    // GARANȚIE TITLU (bug 2026-06-04): titlul nu trebuie să fie niciodată un
    // placeholder/etichetă de tip (ex: „Altele (categoria se creează automat
    // din descriere)"). Asta se scurgea și în subiectul emailului către
    // autorități. Dacă titlul polish-uit e un placeholder, generăm unul real
    // din descriere (AI, cu fallback determinist). Sursă unică de adevăr pentru
    // TOATE căile (form, cosign, API, share import) — server authoritative.
    if (isPlaceholderTitlu(polished.titlu)) {
      const descForTitle = polished.descriere || safeDescriere;
      try {
        polished.titlu = await generateTitlu({
          descriere: descForTitle,
          locatie: polished.locatie || safeLocatie,
        });
      } catch {
        polished.titlu = deriveTitluFromDescriere(descForTitle);
      }
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
    // 2026-05-29 — lat/lng pot fi null acum (geolocation refuzat / no map pick).
    // Tratam in 2 cazuri: (a) avem coords → poate inlocuim cu geocode result
    // daca textul difera; (b) nu avem → forward geocode obligatoriu.
    // 2026-06-10 — Client-ul trimitea ROMANIA_CENTER (45.9432, 24.9668) ca
    // fallback când geocoding-ul eșua → pin „în munți" (centrul geografic al
    // țării, lângă Sibiu). Îl tratăm ca ABSENT: forțăm forward-geocode din text;
    // dacă nici acela nu prinde street-level, cădem pe centroidul județului.
    const isRomaniaCenter = (la: number | null, ln: number | null) =>
      la != null && ln != null &&
      Math.abs(la - ROMANIA_CENTER[0]) < 0.02 && Math.abs(ln - ROMANIA_CENTER[1]) < 0.02;
    const sentinel = isRomaniaCenter(parsed.lat ?? null, parsed.lng ?? null);
    let finalLat: number | null = sentinel ? null : (parsed.lat ?? null);
    let finalLng: number | null = sentinel ? null : (parsed.lng ?? null);
    try {
      const { getCountyById } = await import("@/data/counties");
      const countyName = parsed.county ? (getCountyById(parsed.county)?.name ?? null) : null;
      const hit = await forwardGeocode(polished.locatie, countyName, parsed.county ?? null);
      // Ignorăm match-uri city-only (streetLevel=false) — astea aterizează
      // pe Piața Constituției / centroidul orașului și NU sunt utile ca pin.
      if (hit && hit.streetLevel) {
        if (finalLat == null || finalLng == null) {
          // Caz (b): nu aveam coords deloc → forward geocode setează valorile.
          finalLat = hit.lat;
          finalLng = hit.lng;
        } else {
          // Caz (a): aveam coords → înlocuim doar dacă textul diferă mult.
          const distKm = haversineKm(finalLat, finalLng, hit.lat, hit.lng);
          if (distKm > 1.5) {
            finalLat = hit.lat;
            finalLng = hit.lng;
          }
        }
      }
    } catch { /* silent — keep what we have */ }

    // Fallback de ultimă instanță: street-level a eșuat, dar dacă știm
    // județul (sau e București, după „Sector N" în text) punem CENTROIDUL
    // orașului — pin aproximativ în orașul CORECT, niciodată în munți. Doar
    // dacă nici județul nu e cunoscut cădem pe 400-ul de mai jos.
    if (finalLat == null || finalLng == null) {
      const sectorInText = /Sector(?:ul)?\s*[1-6]/i.test(`${polished.locatie ?? ""} ${safeLocatie ?? ""}`);
      const fallbackCounty = parsed.county ?? (sectorInText ? "B" : null);
      const centroid = countyCentroid(fallbackCounty);
      if (centroid) {
        finalLat = centroid[0];
        finalLng = centroid[1];
      }
    }

    // Daca dupa geocode + centroid tot nu avem coords (nici județul nu e
    // cunoscut), return 400 friendly (NU Zod raw). Sesizarea fara coords nu
    // poate fi afisata pe harta sau folosita pt proximity routing.
    if (finalLat == null || finalLng == null) {
      return NextResponse.json(
        {
          error: "Nu am putut localiza adresa. Te rugam scrie o adresa mai precisa (ex: Strada Mihai Bravu 122, Sector 2, Bucuresti) sau alege locatia pe harta.",
        },
        { status: 400 },
      );
    }

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
    let resolvedUserId: string | null = user?.id ?? null;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      authorDisplayName = profile?.display_name?.trim() || null;
    } else if (parsed.author_email) {
      // P1.11 — Unificare identitate: dacă utilizatorul e anonim DAR a
      // furnizat un email care matchează un profil existent (case-insensitive),
      // legăm sesizarea de acel profil. Asta repară duplicat-ele „Calapod
      // Bogdan" (anonim) vs „Calapod Marius Bogdan" (logat) — același om.
      try {
        const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
        const adminMatch = createSupabaseAdmin();
        const { data: existingProfile } = await adminMatch
          .from("profiles")
          .select("id, display_name")
          .ilike("email", parsed.author_email)
          .maybeSingle();
        if (existingProfile?.id) {
          resolvedUserId = existingProfile.id;
          authorDisplayName = existingProfile.display_name?.trim() || null;
        }
      } catch { /* silent — nu blocăm submisia */ }
    }
    if (!authorDisplayName) {
      const firstWord = parsed.author_name.trim().split(/\s+/)[0]?.trim();
      authorDisplayName = firstWord || null;
    }

    // 2026-05-26 — Fallback county la creare. Dacă form-ul nu a trimis
    // county (county-context national/anonim), derivăm din `locatie` text
    // ÎNAINTE de insert. Previne bug 00049 (Cluj sesizare → routing București).
    let resolvedCounty = parsed.county;
    let resolvedSector: "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | null = parsed.sector;
    if (!resolvedCounty) {
      const { detectCountyFromLocatie } = await import("@/lib/sesizari/county-from-locatie");
      const detected = detectCountyFromLocatie(polished.locatie);
      if (detected) resolvedCounty = detected;
    }

    // 2026-06-03 — FALLBACK AUTORITAR din lat/lng. Bug sistemic 00050-00058:
    // text-detection eșua pentru străzi necunoscute (ex: „Șoseaua Dobroești")
    // → county=null + sector=null → routing greșit + status blocat pe „nou".
    // Avem finalLat/finalLng GARANTAT non-null aici (line ~255 face return 400
    // altfel). Reverse-geocode-ul Nominatim e sursa de adevăr pentru județ +
    // sector București. Rulează DOAR pe calea de fallback (county lipsă SAU
    // București fără sector), deci fără cost pe submisiile normale.
    if (!resolvedCounty || (resolvedCounty === "B" && !resolvedSector)) {
      try {
        const { reverseGeocode } = await import("@/lib/geo/reverse-geocode");
        const geo = await reverseGeocode(finalLat, finalLng);
        if (!resolvedCounty && geo.countyCode) resolvedCounty = geo.countyCode;
        if (resolvedCounty === "B" && !resolvedSector && geo.sector && /^S[1-6]$/.test(geo.sector)) {
          resolvedSector = geo.sector as "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
        }
      } catch {
        // Best-effort — dacă geocode-ul pică, continuăm cu ce avem.
      }
    }

    // 2026-06-03 — Cazuri de graniță București/Ilfov (ex: 00053, intersecție
    // Bd. Chișinău × Pantelimon): lat/lng cad pe partea Ilfov → reverse-geocode
    // nu detectează sector, deși textul locației spune explicit „Sector N,
    // București". Extragem sectorul din textul polished ca ultim fallback.
    if (resolvedCounty === "B" && !resolvedSector) {
      const sm = polished.locatie.match(/sector\s*([1-6])/i);
      if (sm) resolvedSector = `S${sm[1]}` as "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
    }

    // 2026-05-26 — Identity fallback. Standard Civia.ro: textul formal
    // arată ÎNTOTDEAUNA „Mă numesc X, locuiesc în Y" (cu redactare pe
    // pagina publică). Dacă form-ul a omis author_address dar avem nume +
    // county/locality, derivăm un fallback civic — numele orașului. Pe
    // pagina publică e oricum redactat la „[adresa]"; pentru autorități
    // adresa de oraș + cod sesizare e suficientă pentru identificare.
    let resolvedAuthorAddress = parsed.author_address;
    if (!resolvedAuthorAddress) {
      if (parsed.locality && parsed.locality.trim().length > 0) {
        resolvedAuthorAddress = parsed.locality.trim();
      } else if (resolvedCounty) {
        const { getCountyById } = await import("@/data/counties");
        const countyName = getCountyById(resolvedCounty)?.name;
        if (countyName) resolvedAuthorAddress = countyName;
      }
    }

    // 2026-06-04 — FIX CRITIC (caz 00060): textul formal copia VERBATIM
    // descrierea RAW a cetățeanului („Bună ziua, ... va rog sa instalați...")
    // → salut dublat + limbaj informal + diacritice lipsă, băgate în mijlocul
    // frazei „...constatată pe X: <RAW>". Cauza: foloseam formal_text-ul din
    // formular (generat din descrierea RAW) când avea deja identitate.
    //
    // SOLUȚIE: regenerăm ÎNTOTDEAUNA textul formal server-side din
    // `polished.descriere` (descrierea AI-curățată, fără salut/informal) +
    // template-ul determinist. Garantează text formal curat, consistent, care
    // NU mai oglindește 1:1 ce a tastat user-ul. Pipeline de siguranță aplicat.
    let identityHardenedFormalText = safeFormalText;
    // 2026-06-14 — dacă userul a EDITAT manual textul în formular, îl ONORĂM
    // (safeFormalText = textul lui trecut prin pipeline-ul de siguranță) și
    // NU regenerăm din template — altfel i-am pierde modificările (ex. a scos
    // o solicitare nedorită). Default (needitat): regenerare canonică server-side.
    if (!parsed.formal_text_edited) try {
      const { generateFormalText } = await import("@/lib/sesizari/formal-template");
      const regenerated = generateFormalText({
        tip: parsed.tip,
        locatie: polished.locatie,
        descriere: polished.descriere,
        nume: sanitizeText(parsed.author_name, 120),
        adresa: resolvedAuthorAddress ?? null,
        hasPhotos: (parsed.imagini ?? []).length > 0,
      });
      identityHardenedFormalText = reformatFormalText(
        removeMinimization(
          objectifyFormalText(regenerated, {
            locatie: polished.locatie,
            adresaCetatean: null,
          }).text,
        ).text,
      );
    } catch (regenErr) {
      Sentry.captureException(regenErr, {
        tags: { kind: "formal_text_regen_failed" },
        extra: { code },
      });
      // Fallback: safeFormalText (formular) — mai bine ceva decât să blocăm.
    }

    // 2026-06-09 — Guard anti-double-submit: dacă ACELAȘI autor a creat deja o
    // sesizare identică (același tip + ~aceleași coordonate) în ultimele 5 minute,
    // întoarce-o pe aceea (idempotent) în loc să creăm un duplicat. Cauza reală:
    // 00067/00068 — submit dublu la 14s distanță, conținut identic. Best-effort.
    if (resolvedUserId || parsed.author_email) {
      try {
        const dupAdmin = createSupabaseAdmin();
        const dupCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
        let dq = dupAdmin
          .from("sesizari")
          .select("*")
          .eq("tip", parsed.tip)
          .gte("created_at", dupCutoff)
          .order("created_at", { ascending: false })
          .limit(1);
        dq = resolvedUserId ? dq.eq("user_id", resolvedUserId) : dq.eq("author_email", parsed.author_email!);
        if (finalLat != null && finalLng != null) {
          dq = dq.gte("lat", finalLat - 0.0003).lte("lat", finalLat + 0.0003)
                 .gte("lng", finalLng - 0.0003).lte("lng", finalLng + 0.0003);
        } else {
          dq = dq.eq("locatie", polished.locatie);
        }
        const { data: dup } = await dq;
        if (dup && dup.length > 0) {
          return NextResponse.json({ data: dup[0], deduped: true });
        }
      } catch {
        /* dedup best-effort — nu blocăm crearea pe eroare de query */
      }
    }

    try {
      const row = await createSesizare({
        code,
        user_id: resolvedUserId,
        ...parsed,
        county: resolvedCounty,
        sector: resolvedSector,
        // 2026-06-10 — adresa de domiciliu criptată la nivel de câmp (AES-256-GCM,
        // cheie în env, separat de DB). O scurgere logică a bazei nu expune unde
        // locuiesc cetățenii. Decriptată doar la trimiterea către autoritate.
        author_address: encryptField(resolvedAuthorAddress),
        formal_text: identityHardenedFormalText,
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

      // P3.26 — bump civic streak (non-blocking)
      if (resolvedUserId) {
        const { bumpCivicStreak } = await import("@/lib/civic-streak");
        void bumpCivicStreak(resolvedUserId);
      }

      // 2026-05-18: scos „adopt-a-street" feature complet.
      // 2026-06-04: scoasă și urmărirea (sesizare_follows) — fără notificări
      // către followeri pe sesizare/judeţ.
      // 2026-06-10 (Faza 2): push geo pe area_subscriptions — notifică abonații
      // care urmăresc zona sesizării (dublu opt-in: area push + device push).
      if (resolvedCounty) {
        const { notifyAreaSubscribers } = await import("@/lib/area/notify-push");
        void notifyAreaSubscribers({
          county: resolvedCounty,
          sector: resolvedSector,
          tip: parsed.tip,
          locatie: polished.locatie,
          code,
          titlu: polished.titlu,
          excludeUserId: resolvedUserId,
        });
      }

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
        // polished.titlu e deja garantat curat (vezi guard-ul de titlu mai sus)
        // — NU folosim parsed.titlu (raw) ca să nu ajungă placeholder în
        // emailul de confirmare către cetățean.
        const cleanTitle = sanitizeText(polished.titlu, 120);
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
