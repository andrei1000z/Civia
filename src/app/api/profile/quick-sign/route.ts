/**
 * /api/profile/quick-sign — PATCH user's quick-sign petition data.
 *
 * Salvează datele cu care vom construi URL-ul Declic prefilled. NU semnăm
 * automat în numele user-ului (vezi eIDAS + Termeni Declic) — doar reducem
 * fricțiunea de la formularul Declic.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DECLIC_COUNTIES } from "@/lib/petitii/declic-prefill";
import { getQuickSignDataForCurrentUser } from "@/lib/petitii/quick-sign-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getQuickSignDataForCurrentUser();
  if (!data) {
    return NextResponse.json({ data: null });
  }
  return NextResponse.json({ data });
}

const schema = z.object({
  firstName: z.string().trim().min(1).max(50).nullable(),
  lastName: z.string().trim().min(1).max(50).nullable(),
  email: z.string().trim().email("Email invalid").max(254).nullable(),
  county: z
    .enum(DECLIC_COUNTIES as unknown as [string, ...string[]])
    .nullable(),
  phone: z.string().trim().min(4).max(30).nullable(),
  enabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Trebuie să fii conectat." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validare eșuată", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Dacă user vrea enabled=true, trebuie să aibă minim nume + email.
  if (parsed.data.enabled) {
    if (!parsed.data.firstName || !parsed.data.lastName || !parsed.data.email) {
      return NextResponse.json(
        {
          error:
            "Pentru a activa semnarea rapidă, completează minim prenume, nume și email.",
        },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      quick_sign_first_name: parsed.data.firstName,
      quick_sign_last_name: parsed.data.lastName,
      quick_sign_email: parsed.data.email,
      quick_sign_county: parsed.data.county,
      quick_sign_phone: parsed.data.phone,
      quick_sign_enabled: parsed.data.enabled,
      quick_sign_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
