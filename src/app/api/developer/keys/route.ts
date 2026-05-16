import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api/auth";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().min(3).max(100),
  contact_email: z.string().email(),
  use_case: z.enum(["journalism", "research", "ngo", "civic-tech"]).default("civic-tech"),
});

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, key_prefix, label, use_case, scopes, tier, revoked_at, last_used_at, request_count, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  // 3 chei generate / 24h / user — anti-abuz.
  const rl = await rateLimitAsync(`apikey-gen:${user.id}`, { limit: 3, windowMs: 24 * 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Limita 3 chei/zi atinsa." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  // Max 10 chei active / user.
  const admin = createSupabaseAdmin();
  const { count } = await admin
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: "Maxim 10 chei active. Revoca una inainte de a crea alta." },
      { status: 409 },
    );
  }

  const { full, prefix, hash } = generateApiKey();
  const { data, error } = await admin
    .from("api_keys")
    .insert({
      owner_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      label: parsed.data.label,
      contact_email: parsed.data.contact_email,
      use_case: parsed.data.use_case,
      scopes: ["read:sesizari", "read:stats"],
      tier: "free",
    })
    .select("id, key_prefix, label, use_case, scopes, tier, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    key: full, // returnam O SINGURA DATA
    meta: data,
    warning: "Salveaza cheia ACUM. Nu o vei mai putea recupera.",
  });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id missing" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
