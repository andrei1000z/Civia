import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { REF_VISITOR_COOKIE, isValidRefCode } from "@/lib/referral/code";

export const dynamic = "force-dynamic";

/**
 * Sanitize the `next` redirect param — prevent open redirects.
 * Only allow same-origin absolute paths (must start with "/" and not "//").
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  // Must start with single "/", not "//" (protocol-relative URL)
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Reject javascript:, data: etc embedded via encoding
  if (raw.includes("\\") || raw.toLowerCase().includes("javascript:")) return "/";
  return raw;
}

/**
 * Atribuire referral (Faza 1) — la PRIMUL login (signup), dacă există cookie
 * `civia_ref`, legăm noul user de cel care l-a adus. Reguli stricte:
 *   • doar profile NOU create (created_at < 10 min) — nu atribuim useri vechi
 *     care întâmplător dau click pe un link cu ?ref=;
 *   • niciodată self-referral (referrer != user);
 *   • niciodată suprascriere (doar dacă referred_by e încă null).
 * Best-effort: orice eroare e silent (nu blocăm login-ul).
 */
async function attributeReferral(userId: string, refCode: string): Promise<void> {
  try {
    const admin = createSupabaseAdmin();

    const { data: me } = await admin
      .from("profiles")
      .select("id, created_at, referred_by")
      .eq("id", userId)
      .maybeSingle();
    const profile = me as { id: string; created_at: string; referred_by: string | null } | null;
    if (!profile) return;
    if (profile.referred_by) return; // first-touch, niciodată suprascris

    // Doar conturi proaspăt create (signup), nu useri vechi.
    const ageMs = Date.now() - new Date(profile.created_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 10 * 60 * 1000) return;

    const { data: ref } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", refCode)
      .maybeSingle();
    const referrerId = (ref as { id: string } | null)?.id;
    if (!referrerId || referrerId === userId) return; // inexistent sau self

    await admin
      .from("profiles")
      .update({ referred_by: referrerId, referred_at: new Date().toISOString() })
      .eq("id", userId)
      .is("referred_by", null);
  } catch {
    // best-effort — nu blocăm autentificarea pe o eroare de atribuire
  }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);

      // Atribuire referral best-effort + curățare cookie (o singură folosire).
      const jar = await cookies();
      const refCode = jar.get(REF_VISITOR_COOKIE)?.value;
      if (isValidRefCode(refCode)) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await attributeReferral(user.id, refCode.toLowerCase());
        res.cookies.set(REF_VISITOR_COOKIE, "", { maxAge: 0, path: "/" });
      }

      return res;
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
