import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  authority_name: z.string().min(3).max(200),
  authority_kind: z.enum([
    "primarie_sector", "primarie_municipiu", "primarie_judet",
    "consiliu_judetean", "politie_locala", "garda_mediu",
    "salubritate", "apa_nova", "termoenergetica", "cnair", "altele",
  ]),
  county: z.string().max(10).optional(),
  sector: z.string().max(20).optional(),
  official_email: z.string().email(),
  phone: z.string().max(20).optional(),
  website: z.string().url().optional().or(z.literal("")),
  role_in_authority: z.string().min(3).max(80),
  _honey: z.string().optional(),
});

/**
 * POST /api/authority/register — primarii pot cere cont oficial Civia.
 *
 * Flow:
 *  1. Cetateanul logat completeaza form-ul (nume autoritate + email oficial)
 *  2. Inseram in `authorities` (verified=false) + `authority_users` (approved=false)
 *  3. Admin Civia verifica manual + activeaza
 *  4. Notificare email cand contul e activ
 *
 * Necesita user logat. Rate-limit 3/zi/IP.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`authority-register:${ip}`, {
    limit: 3,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe cereri. Reincearca maine." }, { status: 429 });
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Trebuie sa te autentifici intai (Google sign-in)." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data._honey) return NextResponse.json({ ok: true });

  const admin = createSupabaseAdmin();

  // Step 1: insert sau gasire authority (poate exista deja)
  let authorityId: string | null = null;
  const { data: existing } = await admin
    .from("authorities")
    .select("id, verified")
    .eq("name", data.authority_name)
    .eq("kind", data.authority_kind)
    .maybeSingle();

  if (existing) {
    authorityId = (existing as { id: string }).id;
  } else {
    const { data: created, error: createErr } = await admin
      .from("authorities")
      .insert({
        name: data.authority_name,
        kind: data.authority_kind,
        county: data.county ?? null,
        sector: data.sector ?? null,
        official_email: data.official_email,
        phone: data.phone ?? null,
        website: data.website || null,
        verified: false,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: "Nu am putut crea autoritatea. Reincearca." },
        { status: 500 },
      );
    }
    authorityId = (created as { id: string }).id;
  }

  if (!authorityId) {
    return NextResponse.json({ error: "Authority ID lipsa" }, { status: 500 });
  }

  // Step 2: cerere link user → authority (approved=false)
  const { error: linkErr } = await admin
    .from("authority_users")
    .insert({
      user_id: user.id,
      authority_id: authorityId,
      role_in_authority: data.role_in_authority,
      approved: false,
    });
  if (linkErr) {
    if (linkErr.code === "23505") {
      return NextResponse.json(
        { error: "Ai trimis deja o cerere pentru aceasta autoritate." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Eroare linking user" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, authority_id: authorityId });
}
