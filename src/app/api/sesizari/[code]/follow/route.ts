import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Trebuie să fii conectat" }, { status: 401 });
    }

    const rl = await rateLimitAsync(`follow:${user.id}`, { limit: 20, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json({ error: "Prea rapid — așteaptă un minut" }, { status: 429 });
    }

    const sesizare = await getSesizareByCode(code);
    if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("sesizare_follows")
      .upsert(
        { sesizare_id: sesizare.id, user_id: user.id },
        { onConflict: "sesizare_id,user_id" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 2026-05-24 (P3.26) — bump civic streak la follow.
    const { bumpCivicStreak } = await import("@/lib/civic-streak");
    void bumpCivicStreak(user.id);

    return NextResponse.json({ ok: true, following: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Trebuie să fii conectat" }, { status: 401 });
    }

    const rl = await rateLimitAsync(`follow:${user.id}`, { limit: 20, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json({ error: "Prea rapid — așteaptă un minut" }, { status: 429 });
    }

    const sesizare = await getSesizareByCode(code);
    if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("sesizare_follows")
      .delete()
      .eq("sesizare_id", sesizare.id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, following: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
