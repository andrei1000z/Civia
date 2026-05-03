import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { aftermathDataSchema } from "@/lib/proteste/aftermath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  // Aftermath body — all fields validated by shared schema
  aftermath: aftermathDataSchema,
  // Submitter contact (anti-abuse + ca să răspundem la moderare)
  submitter_name: z.string().trim().min(2, "Numele tău").max(120),
  submitter_email: z.string().trim().email("Email invalid").max(200),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(req);

  // 2 submisii / oră / IP — moderation queue absorbs spam.
  const rl = await rateLimitAsync(`proteste-aftermath-save:${ip}`, {
    limit: 2,
    windowMs: 60 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe submisii de aftermath. Așteaptă o oră." },
      { status: 429 },
    );
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
  if (new Date(p.start_at).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "Protestul nu a avut loc încă. Așteaptă să se desfășoare." },
      { status: 400 },
    );
  }
  if (p.aftermath_moderation_status === "pending" || p.aftermath_moderation_status === "approved") {
    return NextResponse.json(
      {
        error:
          p.aftermath_moderation_status === "approved"
            ? "Există deja un aftermath aprobat. Pentru corecții, contactează echipa Civia."
            : "Un aftermath e deja în coada de moderare. Așteaptă aprobarea.",
      },
      { status: 409 },
    );
  }

  // Dacă user-ul e logat, prindem și uid-ul.
  let submittedBy: string | null = null;
  try {
    const supa = await createSupabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    submittedBy = user?.id ?? null;
  } catch {
    submittedBy = null;
  }

  // Update via admin client (bypass RLS) — am validat manual deja.
  const { error: updateErr } = await admin
    .from("proteste")
    .update({
      aftermath_attendance_estimate: a.attendance_estimate,
      aftermath_narrative: a.narrative || null,
      aftermath_chants: a.chants,
      aftermath_key_moments: a.key_moments,
      aftermath_outcome: a.outcome || null,
      aftermath_images: a.images,
      aftermath_videos: a.videos,
      aftermath_sources: a.sources,
      aftermath_submitter_name: parsed.data.submitter_name,
      aftermath_submitter_email: parsed.data.submitter_email,
      aftermath_submitted_by: submittedBy,
      aftermath_submitted_at: new Date().toISOString(),
      aftermath_moderation_status: "pending",
    })
    .eq("id", p.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending_moderation" });
}
