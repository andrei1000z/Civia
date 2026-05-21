import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/sesizari/[code]/replies
 *
 * Returns replies received for a sesizare.
 *
 * PRIVACY (5/21/2026 user request):
 *   - Public viewers see only: authority_name, ai_status, ai_confidence,
 *     ai_authenticity_score, received_at, auto_applied.
 *     NU vad body_text (poate contine numar inregistrare personal),
 *     NU vad ai_summary integral, NU vad ai_nr_inregistrare.
 *   - OWNER (user_id of sesizare) sees TOTUL: body, nr inregistrare,
 *     summary, suggested action, etc.
 *
 * Numarul de inregistrare e PERSONAL al cetateanului care a depus
 * sesizarea — alti cetateni care fac sesizari similare primesc nr
 * diferit. NU il expunem public.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!/^[A-Z0-9]{4,8}$/i.test(code)) {
    return NextResponse.json({ error: "Cod invalid" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: sesizare } = await admin
    .from("sesizari")
    .select("id, user_id, publica, moderation_status")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!sesizare) {
    return NextResponse.json({ error: "Sesizare inexistenta" }, { status: 404 });
  }

  // Determine if requester is the owner
  let isOwner = false;
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === sesizare.user_id) isOwner = true;
  } catch {
    // anonymous viewer
  }

  const { data, error } = await admin
    .from("sesizare_replies")
    .select(`
      id, from_email, from_name, authority_id, authority_name,
      subject, body_text,
      ai_status, ai_confidence, ai_summary, ai_nr_inregistrare,
      ai_deadline, ai_suggested_action,
      ai_authenticity_score, ai_authenticity_reasoning,
      auto_applied, user_confirmed, user_corrected_status,
      trusted_sender, received_at
    `)
    .eq("sesizare_id", sesizare.id)
    .order("received_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Strip private fields for non-owners.
  const sanitized = (data ?? []).map((r) => {
    if (isOwner) return r;
    return {
      ...r,
      // Public viewers see ce s-a intamplat (status, autoritate, data)
      // dar nu detaliile personale (nr inregistrare, body integral, etc.)
      body_text: null,
      subject: null,
      ai_summary: null,
      ai_nr_inregistrare: null,
      ai_deadline: null,
      ai_suggested_action: null,
      ai_authenticity_reasoning: null,
      from_email: null,
      // Keep: authority_name, ai_status, ai_confidence,
      //       ai_authenticity_score, auto_applied, received_at,
      //       trusted_sender (UI badge)
    };
  });

  return NextResponse.json(
    { data: sanitized },
    {
      headers: {
        // Caching diferential — public read can be cached, owner read no-cache
        "Cache-Control": isOwner
          ? "private, no-store"
          : "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
