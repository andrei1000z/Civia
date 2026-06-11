import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp, identityKey } from "@/lib/ratelimit";
import { moderateSesizareContent } from "@/lib/sesizari/content-moderation";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

// NU exporta din route files (Next validează exporturile) — local only.
const BP_CATEGORII = ["mobilitate", "spatii-verzi", "siguranta", "educatie", "sanatate", "altele"] as const;

const createSchema = z.object({
  county: z.string().regex(/^[A-Z]{1,2}$/),
  titlu: z.string().trim().min(8).max(120),
  descriere: z.string().trim().min(20).max(1000),
  categorie: z.enum(BP_CATEGORII).default("altele"),
});

/** GET /api/bp/propuneri?county=B — lista aprobată, sortată după voturi.
 *  Include voturile utilizatorului curent (dacă e logat) pentru UI. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const county = (searchParams.get("county") ?? "B").toUpperCase().slice(0, 2);

  const admin = createSupabaseAdmin();
  const { data: propuneri, error } = await admin
    .from("bp_propuneri")
    .select("id, county, titlu, descriere, categorie, votes_count, created_at")
    .eq("county", county)
    .eq("status", "approved")
    .order("votes_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Voturile mele (best-effort — nelogat → listă goală).
  let myVotes: string[] = [];
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && propuneri && propuneri.length > 0) {
      const { data: votes } = await admin
        .from("bp_voturi")
        .select("propunere_id")
        .eq("user_id", user.id)
        .in("propunere_id", propuneri.map((p) => p.id));
      myVotes = (votes ?? []).map((v) => v.propunere_id as string);
    }
  } catch { /* anonim */ }

  return NextResponse.json(
    { data: propuneri ?? [], myVotes },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST — propune o prioritate. Cere cont (anti-abuz) + moderare conținut. */
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Trebuie să fii autentificat ca să propui o prioritate." },
      { status: 401 },
    );
  }

  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`bp-propune:${identityKey(user.id, ip)}`, {
    limit: 5,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Ai propus deja destule azi — revino mâine." },
      { status: 429 },
    );
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Titlu (min 8 caractere) și descriere (min 20) sunt obligatorii." },
      { status: 400 },
    );
  }

  // Refolosim filtrul de conținut al sesizărilor (threats/profanity).
  const mod = moderateSesizareContent({
    author_name: user.email ?? "utilizator",
    titlu: parsed.data.titlu,
    descriere: parsed.data.descriere,
    locatie: parsed.data.county,
  });
  if (mod.block) {
    Sentry.captureMessage("bp propunere blocked by moderation", {
      level: "warning",
      tags: { kind: "bp_moderation_block" },
      extra: { reason: mod.reason },
    });
    return NextResponse.json(
      { error: "Propunerea conține limbaj nepermis. Reformulează factual." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("bp_propuneri")
    .insert({
      county: parsed.data.county,
      titlu: sanitizeText(parsed.data.titlu, 120),
      descriere: sanitizeText(parsed.data.descriere, 1000),
      categorie: parsed.data.categorie,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    Sentry.captureException(error, { tags: { kind: "bp_propunere_insert" } });
    return NextResponse.json({ error: "Nu am putut salva. Încearcă din nou." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
