import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/, "doar lowercase + cifre + cratimă"),
  title: z.string().min(8).max(200),
  summary: z.string().min(20).max(500),
  body: z.string().min(50),
  image_url: z.string().url().nullable().optional(),
  // External link e obligatoriu — petițiile civice au mereu o sursă oficială.
  external_url: z.string().url("Link extern invalid"),
  // Target opțional — null = nelimitat / cât mai multe semnături.
  target_signatures: z.number().int().min(10).max(10_000_000).nullable().optional(),
  category: z.string().max(40).nullable().optional(),
  county_code: z.string().max(3).nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  // Status mereu „active" la creare. Field păstrat ca enum DB pentru
  // backward-compat dar nu mai e expus în UI.
  status: z.enum(["draft", "active", "closed", "archived"]).default("active"),
});

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Auth required" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false as const, status: 403, error: "Admin only" };
  }
  return { ok: true as const, userId: user.id };
}

/** POST /api/admin/petitii — create new petition (admin only). */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Rate limit defensiv chiar si pe admin endpoints — previne script
  // runaway / compromised admin account de la a crea bulk de petitii.
  const rl = await rateLimitAsync(`admin-petitii-post:${auth.userId}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe petitii — asteapta un minut." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("petitii")
      .insert({
        ...parsed,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug deja folosit" }, { status: 409 });
      }
      throw error;
    }
    // Revalidate cached pages — altfel /petitii arată stale 5min după publish.
    revalidatePath("/petitii");
    if (data?.slug) revalidatePath(`/petitii/${data.slug}`);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation", details: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/admin/petitii — list ALL (inclusiv draft + archived). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("petitii_with_count")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
