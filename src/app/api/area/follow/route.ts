import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { normalizeCounty } from "@/lib/area/subscriptions";

export const dynamic = "force-dynamic";

/**
 * „Urmărește zona" (Faza 2) — gestionează abonările la arie ale userului.
 *
 *   POST   — abonează (consimțământ EXPLICIT obligatoriu: consent===true).
 *   GET    — listează abonările proprii.
 *   DELETE — dezabonează (?id=…).
 *
 * Auth obligatoriu (abonarea cere cont, ca street_follows). RLS forțează ca
 * userul să-și gestioneze DOAR propriile abonări.
 */
const postSchema = z.object({
  county: z.string().min(1).max(20),
  locality: z.string().trim().min(2).max(100).optional().nullable(),
  category: z.string().trim().min(2).max(40).optional().nullable(),
  email_optin: z.boolean().optional(),
  push_optin: z.boolean().optional(),
  consent: z.literal(true), // GDPR — consimțământ explicit, nu implicit din click
  source: z.enum(["web", "county_page", "sesizari_publice", "cont", "api"]).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`area-follow:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Trebuie să fii autentificat" }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: "Cont fără email" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Date invalide" }, { status: 400 });
  }
  const county = normalizeCounty(parsed.data.county);
  if (!county) return NextResponse.json({ error: "Județ invalid" }, { status: 400 });

  const locality = parsed.data.locality?.trim() || null;
  const category = parsed.data.category?.trim() || null;
  const email_optin = parsed.data.email_optin ?? true;
  const push_optin = parsed.data.push_optin ?? false;
  const source = parsed.data.source ?? "web";

  // Există deja abonarea? (dedup pe user+county+locality+category, NULL-aware).
  let q = supabase
    .from("area_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("county", county);
  q = locality ? q.eq("locality", locality) : q.is("locality", null);
  q = category ? q.eq("category", category) : q.is("category", null);
  const { data: existing } = await q.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("area_subscriptions")
      .update({ email_optin, push_optin, email: user.email, consent_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: (existing as { id: string }).id, updated: true });
  }

  const { data: inserted, error } = await supabase
    .from("area_subscriptions")
    .insert({
      user_id: user.id,
      email: user.email,
      county,
      locality,
      category,
      email_optin,
      push_optin,
      consent_source: source,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (inserted as { id: string }).id, created: true });
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data } = await supabase
    .from("area_subscriptions")
    .select("id, county, locality, category, email_optin, push_optin, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }
  // RLS asigură că ștergem doar abonarea proprie.
  const { error } = await supabase.from("area_subscriptions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
