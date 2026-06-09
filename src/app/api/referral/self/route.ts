import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureReferralCode, REF_SELF_COOKIE } from "@/lib/referral/code";

export const dynamic = "force-dynamic";

/**
 * Referral (Faza 1) — întoarce codul PROPRIU al userului logat și îl pune
 * într-un cookie JS-readable (`civia_rc`), ca ShareMenu/SuccessScreen să-l
 * adauge `?ref=` pe URL-urile partajate, fără a expune UUID-ul userului.
 *
 * Apelat o dată de `<ReferralSelfBridge>` în layout. Pentru anonimi → 204
 * (fără cod, fără cookie).
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const admin = createSupabaseAdmin();
  const code = await ensureReferralCode(admin, user.id);
  if (!code) return new NextResponse(null, { status: 204 });

  const res = NextResponse.json({ code });
  res.cookies.set(REF_SELF_COOKIE, code, {
    maxAge: 60 * 60 * 24 * 180, // 180 zile
    httpOnly: false, // citit de ShareMenu (client) ca să pună ?ref=
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
