import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { broadcastToAllSubscribers } from "@/lib/push/web-push-client";
import { broadcastNewCivicContent } from "@/lib/notify/broadcast-civic";

export const dynamic = "force-dynamic";

const isoDate = z.string().datetime();

// All optional — partial update.
const updateSchema = z.object({
  slug: z.string().trim().min(3).max(120).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  subtitle: z.string().trim().max(280).optional().nullable(),
  cause: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().min(10).max(20000).optional(),
  demands: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  start_at: isoDate.optional(),
  end_at: isoDate.optional().nullable(),
  location_name: z.string().trim().min(2).max(200).optional(),
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
  status: z.enum(["planificat", "in_desfasurare", "incheiat", "anulat"]).optional(),
  visibility: z.enum(["publica", "draft"]).optional(),
  featured: z.boolean().optional(),
  color_theme: z.string().trim().max(40).optional(),
  // Moderation (set by admin from /admin/proteste approve/reject buttons)
  moderation_status: z.enum(["pending", "approved", "rejected"]).optional(),
  rejected_reason: z.string().trim().max(2000).optional().nullable(),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out as T;
}

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

    // Capture old slug + old moderation_status to:
    // - revalidate previous URL if slug changed
    // - decide dacă trebuie să broadcast push (transition → approved)
    let oldSlug: string | null = null;
    let oldModerationStatus: string | null = null;
    if (parsed.slug || parsed.moderation_status) {
      const { data: existing } = await admin
        .from("proteste")
        .select("slug, moderation_status")
        .eq("id", id)
        .maybeSingle();
      oldSlug = (existing as { slug?: string } | null)?.slug ?? null;
      oldModerationStatus =
        (existing as { moderation_status?: string } | null)?.moderation_status ?? null;
    }

    const { data, error } = await admin
      .from("proteste")
      .update(emptyToNull(parsed))
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Slug-ul „${parsed.slug}" e deja folosit. Alege altul.` },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/proteste");
    const newSlug = (data as { slug: string }).slug;
    revalidatePath(`/proteste/${newSlug}`);
    if (oldSlug && oldSlug !== newSlug) {
      revalidatePath(`/proteste/${oldSlug}`);
    }

    // Broadcast push când protest tocmai devine approved (transitions doar
    // dintr-un status != "approved"). Fire-and-forget via `after()`.
    if (
      parsed.moderation_status === "approved" &&
      oldModerationStatus !== "approved"
    ) {
      const rec = data as { title?: string; subtitle?: string | null };
      const title = rec.title;
      if (title) {
        after(async () => {
          await broadcastToAllSubscribers({
            title: "✊ Protest nou anunțat",
            body: title,
            url: `/proteste/${newSlug}`,
            tag: `protest-${newSlug}`,
            icon: "/icon-192.png",
          });
          await broadcastNewCivicContent({
            kind: "protest",
            title,
            subtitle: rec.subtitle ?? null,
            path: `/proteste/${newSlug}`,
          });
        });
      }
    }

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
  const { data: row } = await admin
    .from("proteste")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const { error } = await admin.from("proteste").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/proteste");
  if (row && (row as { slug?: string }).slug) {
    revalidatePath(`/proteste/${(row as { slug: string }).slug}`);
  }
  return NextResponse.json({ ok: true });
}
