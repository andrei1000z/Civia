import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const followSchema = z.object({
  street: z.string().min(2).max(100),
  county: z.string().min(1).max(4),
});

const MAX_FOLLOWS_PER_USER = 20;

/**
 * POST /api/streets/follow
 * Body: { street: string, county: string }
 *
 * Adaugă un follow pentru user-ul logat. Limită 20 per user pentru a
 * preveni abuz.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nu ești autentificat" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid" }, { status: 400 });
  }

  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }

  const street = parsed.data.street.trim().toLowerCase();
  const county = parsed.data.county.trim().toLowerCase();

  // Verificare limită — 20 follows max per user.
  const { count } = await supabase
    .from("street_follows")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_FOLLOWS_PER_USER) {
    return NextResponse.json(
      { error: `Maxim ${MAX_FOLLOWS_PER_USER} străzi urmărite. Renunță la una.` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("street_follows")
    .upsert(
      { user_id: user.id, street, county },
      { onConflict: "user_id,street,county" },
    )
    .select("id, street, county, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** GET /api/streets/follow → listă follow-uri ale user-ului. */
export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nu ești autentificat" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("street_follows")
    .select("id, street, county, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
