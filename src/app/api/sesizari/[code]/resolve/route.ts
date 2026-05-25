import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { humanizeSupabaseError } from "@/lib/supabase/errors";
import { invalidateSesizariCache } from "@/lib/cached-queries";
import { rateLimitAsync } from "@/lib/ratelimit";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";

export const dynamic = "force-dynamic";

const resolveSchema = z.object({
  resolved_photo_url: z.string().url().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const rl = await rateLimitAsync(`resolve:${user.id}`, { limit: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json({ error: "Prea multe încercări" }, { status: 429 });
    }

    const sesizare = await getSesizareByCode(code);
    if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only author can mark resolved (by user_id OR by matching email)
    const isAuthor = sesizare.user_id === user.id || sesizare.author_email === user.email;
    if (!isAuthor) {
      return NextResponse.json(
        { error: "Doar autorul sesizării poate marca ca rezolvată" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = resolveSchema.parse(body);

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("sesizari")
      .update({
        status: "rezolvat",
        resolved_at: new Date().toISOString(),
        resolved_by_author: true,
        resolved_photo_url: parsed.resolved_photo_url ?? null,
      })
      .eq("id", sesizare.id);

    if (error) {
      const h = humanizeSupabaseError(error);
      return NextResponse.json({ error: h.message }, { status: h.status });
    }

    // Adaugă eveniment în timeline cu dedupe. Dacă admin-ul a flippat
    // deja status pe „rezolvat" cu o notă reală (e.g. „S-au montat
    // stâlpișori"), nu suprapunem cu un al doilea rând generic.
    await appendTimelineEvent({
      admin,
      sesizareId: sesizare.id,
      eventType: "rezolvat",
      description: null, // → tratat ca generic; rezolvă conflictul cu admin row
      sentryTags: { source: "citizen_resolve_route" },
      sentryExtra: { code: sesizare.code },
    });

    invalidateSesizariCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Input invalid" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
