import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * POST /api/push/subscribe
 * Body: PushSubscription serialized JSON
 *
 * Salveaza subscription-ul user-ului. RLS asigura ca un user vede doar
 * propriile subscriptions. Upsert pe (user_id, endpoint) pentru a evita
 * duplicate când userul reactivează permission.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nu ești autentificat" }, { status: 401 });
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
      { error: parsed.error.issues[0]?.message ?? "Subscription invalid" },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 280) ?? null;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** DELETE /api/push/subscribe?endpoint=... */
export async function DELETE(req: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nu ești autentificat" }, { status: 401 });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "Lipsește endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
