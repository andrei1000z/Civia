import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/sesizari/drafts — salvează un draft de sesizare (autosave).
 *
 * Folosit de SesizareForm pentru a persista server-side ce a tipărit
 * user-ul, ca să putem trimite un nudge la 24h dacă nu finalizează.
 * RLS asigură că doar user-ul propriu citește draftul. Anonimii cu email
 * sunt OK (user_id=null, dar email-ul e suficient pentru nudge).
 */

const schema = z.object({
  email: z.string().email().optional().nullable(),
  tip: z.string().max(40).optional().nullable(),
  titlu: z.string().max(200).optional().nullable(),
  locatie: z.string().max(500).optional().nullable(),
  descriere: z.string().max(3000).optional().nullable(),
  county: z.string().max(5).optional().nullable(),
  sector: z.string().max(10).optional().nullable(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`drafts:${ip}`, { limit: 30, windowMs: 5 * 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe drafturi" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { tip, titlu, locatie, descriere, county, sector } = parsed.data;
  const email = parsed.data.email?.trim().toLowerCase() ?? null;

  // Cer cel puțin email SAU user_id ca să putem trimite nudge.
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !email) {
    return NextResponse.json({ error: "Email necesar pentru salvare draft" }, { status: 400 });
  }

  // Anti-spam: doar dacă draftul are cel puțin niște conținut (descriere >= 10 caractere
  // sau titlu prezent), îl persistăm. Altfel form gol nu merită salvat.
  const hasContent = (descriere?.length ?? 0) >= 10 || (titlu?.length ?? 0) >= 3 || (locatie?.length ?? 0) >= 3;
  if (!hasContent) {
    return NextResponse.json({ ok: true, skipped: "no_content" });
  }

  const payload = {
    user_id: user?.id ?? null,
    email,
    tip,
    titlu,
    locatie,
    descriere,
    county,
    sector,
    updated_at: new Date().toISOString(),
  };

  // Upsert: dacă există un draft incomplet în ultimele 24h pentru același
  // user/email, îl update-uim. Altfel creăm un nou rând.
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  let existingQuery = supabase
    .from("sesizari_drafts")
    .select("id")
    .is("completed_sesizare_code", null)
    .gte("created_at", cutoff)
    .limit(1);

  if (user) {
    existingQuery = existingQuery.eq("user_id", user.id);
  } else if (email) {
    existingQuery = existingQuery.eq("email", email);
  }

  const { data: existing } = await existingQuery.maybeSingle();
  if (existing?.id) {
    await supabase.from("sesizari_drafts").update(payload).eq("id", existing.id);
    return NextResponse.json({ ok: true, draft_id: existing.id, action: "updated" });
  }

  const { data: created, error } = await supabase
    .from("sesizari_drafts")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, draft_id: created?.id, action: "created" });
}
