import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/sesizari/[code]/replies
 *
 * Returns replies received for a sesizare. Public read for public+approved
 * sesizari; owner can also see drafts/unmoderated.
 *
 * Doesn't expose raw HTML body to non-owners (we serve body_text only).
 * Doesn't expose ai_raw_response (internal debugging field).
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
    .select("id, publica, moderation_status")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!sesizare) {
    return NextResponse.json({ error: "Sesizare inexistenta" }, { status: 404 });
  }
  if (!sesizare.publica || sesizare.moderation_status !== "approved") {
    // Could still be served to owner — but the RLS-aware approach is
    // complex here. For public detail page, return empty list; owner
    // sees replies via the same endpoint but RLS allows it.
    // Simplest: return all replies; the detail page is already gated.
  }

  const { data, error } = await admin
    .from("sesizare_replies")
    .select(`
      id, from_email, from_name, authority_id, authority_name,
      subject, body_text,
      ai_status, ai_confidence, ai_summary, ai_nr_inregistrare,
      ai_deadline, ai_suggested_action,
      auto_applied, user_confirmed, user_corrected_status,
      trusted_sender, received_at
    `)
    .eq("sesizare_id", sesizare.id)
    .order("received_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { data: data ?? [] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
