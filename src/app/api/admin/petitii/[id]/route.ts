import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(8).max(200).optional(),
  summary: z.string().min(20).max(500).optional(),
  body: z.string().min(50).optional(),
  image_url: z.string().url().nullable().optional(),
  external_url: z.string().url().optional(),
  target_signatures: z.number().int().min(10).max(10_000_000).nullable().optional(),
  category: z.string().max(40).nullable().optional(),
  county_code: z.string().max(3).nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "closed", "archived"]).optional(),
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
  return { ok: true as const };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Defensiv pe admin endpoint — limita pe IP previne abuse din script
  // chiar daca admin account compromised.
  const rl = await rateLimitAsync(`admin-petitii-patch:${getClientIp(req)}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe modificari." }, { status: 429 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.parse(body);
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("petitii")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug deja folosit" }, { status: 409 });
      }
      throw error;
    }
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const admin = createSupabaseAdmin();
  // Get slug before delete pentru revalidatePath
  const { data: existing } = await admin.from("petitii").select("slug").eq("id", id).maybeSingle();
  const { error } = await admin.from("petitii").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/petitii");
  if (existing?.slug) revalidatePath(`/petitii/${existing.slug}`);
  return NextResponse.json({ ok: true });
}
