import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/intreruperi?alert=invalid`, 302);
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("intreruperi_alerts")
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.redirect(`${SITE_URL}/intreruperi?alert=invalid`, 302);
  }
  return NextResponse.redirect(`${SITE_URL}/intreruperi?alert=confirmed`, 302);
}
