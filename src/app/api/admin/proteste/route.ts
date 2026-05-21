import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const isoDate = z.string().datetime();

const createSchema = z.object({
  slug: z.string().trim().min(3).max(120).optional(),
  title: z.string().trim().min(3).max(200),
  subtitle: z.string().trim().max(280).optional().nullable(),
  cause: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().min(10).max(20000),
  demands: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  start_at: isoDate,
  end_at: isoDate.optional().nullable(),
  location_name: z.string().trim().min(2).max(200),
  city: z.string().trim().max(120).optional().nullable(),
  county_slug: z.string().trim().max(40).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  organizer: z.string().trim().max(200).optional().nullable(),
  organizer_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  contact_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  external_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  hashtag: z.string().trim().max(60).optional().nullable(),
  cover_image_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  cover_image_credit: z.string().trim().max(200).optional().nullable(),
  expected_attendance: z.number().int().min(0).max(10_000_000).optional().nullable(),
  status: z
    .enum(["planificat", "in_desfasurare", "incheiat", "anulat"])
    .default("planificat"),
  visibility: z.enum(["publica", "draft"]).default("publica"),
  featured: z.boolean().default(false),
  color_theme: z.string().trim().max(40).default("warning"),
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

/** Coerce empty-string fields back to null so Postgres stores NULL. */
function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out as T;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("proteste")
    .select("*")
    .order("start_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Rate limit defensiv pe IP — chiar daca admin compromised.
  const rl = await rateLimitAsync(`admin-proteste-post:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe proteste." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    // Generate slug from title if not provided. Slug-uniqueness is enforced
    // by the DB; on collision we suffix `-2`, `-3`, ... up to 50 tries.
    const baseSlug = (parsed.slug && parsed.slug.length > 0
      ? slugify(parsed.slug)
      : slugify(parsed.title)
    ).slice(0, 100) || "protest";

    const admin = createSupabaseAdmin();
    let finalSlug = baseSlug;
    for (let i = 1; i < 50; i++) {
      const { data: existing } = await admin
        .from("proteste")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();
      if (!existing) break;
      finalSlug = `${baseSlug}-${i + 1}`;
    }

    const insertPayload = emptyToNull({
      ...parsed,
      slug: finalSlug,
      demands: parsed.demands ?? [],
      tags: parsed.tags ?? [],
      created_by: auth.userId,
    });

    const { data, error } = await admin
      .from("proteste")
      .insert(insertPayload)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidatePath("/proteste");
    revalidatePath(`/proteste/${finalSlug}`);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation", details: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
