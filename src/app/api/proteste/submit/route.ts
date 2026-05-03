import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const isoDate = z.string().datetime();

// Schema relaxată — public submission, doar 4 câmpuri obligatorii.
// Restul sunt optionale; admin-ul completează la moderare dacă lipsesc.
const submitSchema = z.object({
  // OBLIGATORII
  title: z.string().trim().min(5, "Titlu prea scurt").max(200),
  location_name: z.string().trim().min(2, "Locație necesară").max(200),
  start_at: isoDate,
  description: z.string().trim().min(20, "Descrie protestul în câteva propoziții").max(20000),

  // OBLIGATORII pentru contact (anti-abuse + ca să răspundem)
  submitter_name: z.string().trim().min(2, "Numele tău").max(120),
  submitter_email: z.string().trim().email("Email invalid").max(200),

  // OPTIONALE — orice dintre astea
  subtitle: z.string().trim().max(280).optional(),
  cause: z.string().trim().max(120).optional(),
  end_at: isoDate.optional(),
  city: z.string().trim().max(120).optional(),
  county_slug: z.string().trim().max(40).optional(),
  organizer: z.string().trim().max(200).optional(),
  organizer_url: z.string().url().max(500).optional().or(z.literal("")),
  external_url: z.string().url().max(500).optional().or(z.literal("")),
  hashtag: z.string().trim().max(60).optional(),
  expected_attendance: z.number().int().min(0).max(10_000_000).optional(),
  demands: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  submitter_note: z.string().trim().max(2000).optional(),

  // Organizer self-identification (introduced in 031)
  is_organizer_submission: z.boolean().optional(),
  // URL produs de /api/upload?kind=document (image sau PDF)
  organizer_proof_url: z.string().url().max(500).optional().or(z.literal("")),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
  }
  return out as T;
}

export async function POST(req: Request) {
  // Rate limit: 3 submisii/oră per IP — submission-uri sunt rare normal,
  // dar n-am vrut să facem 1/zi că oameni de bună-credință pot greși și
  // submite din nou.
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`proteste-submit:${ip}`, {
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe submisii. Așteaptă o oră." },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const parsed = submitSchema.parse(body);

    // Anti-spam ușor: refuză titluri cu doar majuscule sau care conțin
    // URL-uri în titlu (red-flag pentru spam ad-uri).
    const t = parsed.title;
    if (t === t.toUpperCase() && t.length > 15) {
      return NextResponse.json(
        { error: "Folosește scriere normală, nu doar majuscule." },
        { status: 400 },
      );
    }
    if (/https?:\/\//i.test(t)) {
      return NextResponse.json(
        { error: "Titlul nu poate conține URL-uri." },
        { status: 400 },
      );
    }

    // Dacă utilizatorul declară că e organizator, dovada e obligatorie.
    // Altfel verificarea ar fi imposibilă — oricine ar putea ștampila
    // statutul de „organizator" în admin fără probă.
    if (parsed.is_organizer_submission && !parsed.organizer_proof_url) {
      return NextResponse.json(
        { error: "Pentru statutul de organizator, atașează dovada (aprobare primărie sau document oficial)." },
        { status: 400 },
      );
    }

    // Slug temporar — admin-ul îl ajustează la moderare dacă vrea.
    const baseSlug = (slugify(parsed.title).slice(0, 100) || "protest");
    const admin = createSupabaseAdmin();
    const finalSlug = `${baseSlug}-${Date.now().toString(36).slice(-5)}`;
    // Slug de submisie include un suffix random ca să garanteze unicitate
    // (nu e folosit până la aprobare, când admin-ul îl poate edita).

    const insertPayload = emptyToNull({
      slug: finalSlug,
      title: parsed.title,
      subtitle: parsed.subtitle ?? null,
      cause: parsed.cause ?? null,
      description: parsed.description,
      demands: parsed.demands ?? [],
      tags: [],
      start_at: parsed.start_at,
      end_at: parsed.end_at ?? null,
      location_name: parsed.location_name,
      city: parsed.city ?? null,
      county_slug: parsed.county_slug ?? null,
      organizer: parsed.organizer ?? null,
      organizer_url: parsed.organizer_url ?? null,
      external_url: parsed.external_url ?? null,
      hashtag: parsed.hashtag ?? null,
      expected_attendance: parsed.expected_attendance ?? null,
      submitter_name: parsed.submitter_name,
      submitter_email: parsed.submitter_email,
      submitter_note: parsed.submitter_note ?? null,
      is_organizer_submission: parsed.is_organizer_submission ?? false,
      organizer_proof_url: parsed.organizer_proof_url || null,
      // CHEILE de stare — submission întotdeauna pending + draft.
      status: "planificat",
      visibility: "draft",
      moderation_status: "pending",
      featured: false,
      color_theme: "warning",
    });

    const { data, error } = await admin
      .from("proteste")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: (data as { id: string }).id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Date invalide" },
        { status: 400 },
      );
    }
    const msg = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
