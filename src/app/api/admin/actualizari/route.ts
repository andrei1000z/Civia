/**
 * POST /api/admin/actualizari — creează actualizare nouă.
 * GET — listează toate (inclusiv drafts) pentru admin.
 *
 * Plan 5/23/2026. Admin-only: verify role='admin' din profile.
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

const createSchema = z.object({
  versiune: z.string().regex(/^\d+\.\d+\.\d+$/, "Format semver invalid (X.Y.Z)"),
  data: z.string().min(10), // ISO datetime
  titlu: z.string().min(1).max(200),
  descriere: z.string().max(2000).nullable().optional(),
  schimbari: z.array(schimbareSchema).default([]),
  major: z.boolean().default(false),
  minimalist: z.boolean().default(false),
  continut_markdown: z.string().max(10000).nullable().optional(),
  published: z.boolean().default(true),
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
    return { ok: false, error: "Forbidden — admin role required" };
  }
  return { ok: true };
}

export async function GET() {
  const auth = await checkAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("actualizari")
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await checkAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
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
      .insert({
        ...parsed.data,
        descriere: parsed.data.descriere ?? null,
        continut_markdown: parsed.data.continut_markdown ?? null,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // 2026-05-26 — bust ISR cache pe pagina publică. Fără asta, /actualizari
    // rămâne cu fallback v0.0.0 până la următoarea revalidare (1h) chiar
    // dacă admin tocmai a adăugat versiunea nouă.
    revalidatePath("/actualizari");
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare" },
      { status: 500 },
    );
  }
}
