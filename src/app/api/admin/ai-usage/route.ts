import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getQuotaSnapshot } from "@/lib/ai/budget";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai-usage
 *
 * Plan item #92 (5/22/2026) — AI feature analytics:
 *   - cate calls/zi pe feature (improve/vision/chat/classify/severity)
 *   - global usage vs budget
 *   - daily reset window
 *
 * Foundation pentru admin dashboard cu „Live AI cost meter" (#110).
 * Auth: admin only.
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const snapshot = await getQuotaSnapshot();

  return NextResponse.json({
    ok: true,
    data: {
      ...snapshot,
      utilizationPct: Math.round((snapshot.globalUsed / snapshot.globalLimit) * 100),
      // Helper text pentru UI
      status:
        snapshot.globalUsed >= snapshot.globalLimit
          ? "exceeded"
          : snapshot.globalUsed >= snapshot.globalLimit * 0.8
            ? "warning"
            : "ok",
    },
  });
}
