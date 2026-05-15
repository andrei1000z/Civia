import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/streets/unfollow/[id]
 * RLS guarantees user can only delete own follows. ID = UUID din street_follows.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nu ești autentificat" }, { status: 401 });
  }

  const { error } = await supabase
    .from("street_follows")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
