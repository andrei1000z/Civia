/**
 * PATCH /api/admin/actualizari/[versiune] — update.
 * DELETE — șterge.
 *
 * Plan 5/23/2026.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const schimbareSchema = z.object({
  categorie: z.enum(["release", "feature", "fix", "ux", "perf", "security"]),
  text: z.string().min(1).max(500),
});

const updateSchema = z.object({
  data: z.string().min(10).optional(),
  titlu: z.string().min(1).max(200).optional(),
  descriere: z.string().max(2000).nullable().optional(),
  schimbari: z.array(schimbareSchema).optional(),
  major: z.boolean().optional(),
  minimalist: z.boolean().optional(),
  continut_markdown: z.string().max(10000).nullable().optional(),
  published: z.boolean().optional(),
});

async function checkAdmin(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Trebuie să fii autentificat" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ versiune: string }> },
) {
  const auth = await checkAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { versiune } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("actualizari")
      .update(parsed.data)
      .eq("versiune", versiune)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    revalidatePath("/actualizari");
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ versiune: string }> },
) {
  const auth = await checkAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { versiune } = await ctx.params;
  try {
    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("actualizari")
      .delete()
      .eq("versiune", versiune);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    revalidatePath("/actualizari");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare" },
      { status: 500 },
    );
  }
}
