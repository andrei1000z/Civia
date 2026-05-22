import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /admin/actualizari/[versiune]/delete — handler pentru delete
 * din formularul din lista admin. Redirect înapoi la listă după succes.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ versiune: string }> },
) {
  const { versiune } = await ctx.params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/", _req.url));
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.redirect(new URL("/", _req.url));
  }

  const admin = createSupabaseAdmin();
  await admin.from("actualizari").delete().eq("versiune", versiune);

  return NextResponse.redirect(new URL("/admin/actualizari", _req.url));
}
