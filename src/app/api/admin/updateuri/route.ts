import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  // Free-text version label so we can do "V1.1 — hotfix" if needed.
  // Trimmed + lengthcap to avoid silly entries like "V1            ".
  version: z.string().trim().min(1).max(20),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(10).max(20000),
  // Optional ISO timestamp — defaults to now() in the DB.
  published_at: z.string().datetime().optional(),
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

/**
 * GET — list all updates (admin convenience). Public listing
 * happens via direct Supabase query in /updateuri/page.tsx.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("platform_updates")
    .select("id,version,title,body,published_at,created_at,updated_at")
    .order("published_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * POST — create a new update entry.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("platform_updates")
      .insert({
        version: parsed.version,
        title: parsed.title,
        body: parsed.body,
        ...(parsed.published_at ? { published_at: parsed.published_at } : {}),
        created_by: auth.userId,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Versiunea „${parsed.version}" există deja. Folosește un alt label (ex: V1.1).` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    revalidatePath("/updateuri");
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation", details: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
