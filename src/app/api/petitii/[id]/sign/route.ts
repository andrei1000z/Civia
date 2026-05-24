import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const schema = z.object({
  comment: z.string().max(200).nullable().optional(),
});

/**
 * POST /api/petitii/{id}/sign
 *
 * Auth: required.
 * Rate-limit: 5 sign-actions/min per user (sign or unsign).
 * One signature per (petitie, user) — DB unique constraint enforces.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: petitieId } = await params;
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const rl = await rateLimitAsync(`petitie-sign:${user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Prea multe acțiuni" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = schema.parse(body);

    // Get user display_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName =
      (profile as { display_name: string } | null)?.display_name ||
      user.email?.split("@")[0] ||
      "Cetățean";

    // Verify petitie is active
    const { data: petitie, error: pErr } = await supabase
      .from("petitii")
      .select("id, status")
      .eq("id", petitieId)
      .maybeSingle();
    if (pErr || !petitie) {
      return NextResponse.json({ error: "Petiția nu există" }, { status: 404 });
    }
    if ((petitie as { status: string }).status !== "active") {
      return NextResponse.json({ error: "Petiția nu mai e activă" }, { status: 400 });
    }

    // Insert signature (unique constraint blocks double-signing)
    const { error: insErr } = await supabase.from("petitie_signatures").insert({
      petitie_id: petitieId,
      user_id: user.id,
      display_name: displayName,
      comment: parsed.comment ? sanitizeText(parsed.comment, 200) : null,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "Ai semnat deja această petiție" }, { status: 409 });
      }
      throw insErr;
    }

    // 2026-05-24 (P3.26) — bump civic streak la semnare petiție.
    const { bumpCivicStreak } = await import("@/lib/civic-streak");
    void bumpCivicStreak(user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE = unsign (user can withdraw their signature). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: petitieId } = await params;
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }
    const { error } = await supabase
      .from("petitie_signatures")
      .delete()
      .eq("petitie_id", petitieId)
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
