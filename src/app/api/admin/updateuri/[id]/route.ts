import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  version: z.string().trim().min(1).max(20).optional(),
  title: z.string().trim().min(3).max(140).optional(),
  body: z.string().trim().min(10).max(20000).optional(),
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
  return { ok: true as const };
}

/**
 * PATCH — partial update of a platform_updates row. Only the fields
 * present in the body get touched.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.parse(body);
    if (Object.keys(parsed).length === 0) {
      return NextResponse.json({ error: "Nimic de actualizat" }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("platform_updates")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Versiunea „${parsed.version}" există deja.` },
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

/**
 * DELETE — hard-delete an update entry.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("platform_updates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/updateuri");
  return NextResponse.json({ ok: true });
}
