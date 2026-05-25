import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { aftermathDataSchema, filterValidMedia } from "@/lib/proteste/aftermath";
import { requireAdmin } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: nu mai cerem submitter info, contul admin = autoritate.
const saveSchema = z.object({
  aftermath: aftermathDataSchema,
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalid (nu JSON)." }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide." },
      { status: 400 },
    );
  }

  // Cel puțin un câmp non-trivial trebuie să existe — altfel e submisie
  // goală (probabil bot).
  const a = parsed.data.aftermath;
  const hasContent =
    !!a.narrative.trim() ||
    a.attendance_estimate !== null ||
    a.chants.length > 0 ||
    a.messages.length > 0 ||
    a.images.length > 0 ||
    a.videos.length > 0 ||
    a.sources.length > 0;
  if (!hasContent) {
    return NextResponse.json(
      { error: "Adaugă cel puțin narrative, estimare participanți sau o sursă." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();

  // Verifică protestul există + e public + s-a desfășurat + nu are deja
  // aftermath în pending sau approved.
  const { data: protest, error: fetchErr } = await admin
    .from("proteste")
    .select("id, start_at, visibility, moderation_status, aftermath_moderation_status")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchErr || !protest) {
    return NextResponse.json({ error: "Protest inexistent." }, { status: 404 });
  }
  const p = protest as {
    id: string;
    start_at: string;
    visibility: string;
    moderation_status: string;
    aftermath_moderation_status: string;
  };
  if (p.visibility !== "publica" || p.moderation_status !== "approved") {
    return NextResponse.json({ error: "Protestul nu e public." }, { status: 403 });
  }
  if (new Date(p.start_at) > new Date()) {
    return NextResponse.json(
      { error: "Protestul nu a avut loc încă. Așteaptă să se desfășoare." },
      { status: 400 },
    );
  }
  // Admin poate suprascrie aftermath existent (corecții).

  // Validare finală media URLs — în caz că admin a editat manual lista
  // sau a pastat URL-uri broken. Same logică ca în scrape route.
  const { images: validImages, videos: validVideos } = await filterValidMedia(
    a.images,
    a.videos,
  );

  // Update via admin client (bypass RLS). Admin = autoritate, publică direct
  // ca approved (nu mai trecem prin pending). Auto-published_at = now.
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("proteste")
    .update({
      aftermath_attendance_estimate: a.attendance_estimate,
      aftermath_narrative: a.narrative || null,
      aftermath_chants: a.chants,
      aftermath_messages: a.messages,
      aftermath_key_moments: a.key_moments,
      aftermath_outcome: a.outcome || null,
      aftermath_images: validImages,
      aftermath_videos: validVideos,
      aftermath_sources: a.sources,
      aftermath_submitted_by: auth.userId,
      aftermath_submitted_at: nowIso,
      aftermath_moderation_status: "approved",
      aftermath_published_at: nowIso,
    })
    .eq("id", p.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "published" });
}
