import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync, getClientIp, identityKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({ propunereId: z.string().uuid() });

/** Numărul maxim de voturi ACTIVE per utilizator per oraș (k-approval).
 *  Research: k mic forțează prioritizarea reală, nu „like la tot". */
const MAX_VOTURI_PER_ORAS = 3;

/** POST /api/bp/vot — toggle: votezi dacă n-ai votat, retragi dacă ai votat. */
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Trebuie să fii autentificat ca să votezi." },
      { status: 401 },
    );
  }

  const rl = await rateLimitAsync(`bp-vot:${identityKey(user.id, getClientIp(req))}`, {
    limit: 30,
    windowMs: 10 * 60_000,
  });
  if (!rl.success) return NextResponse.json({ error: "Prea multe acțiuni. Așteaptă puțin." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: prop } = await admin
    .from("bp_propuneri")
    .select("id, county, status")
    .eq("id", parsed.data.propunereId)
    .maybeSingle();
  if (!prop || prop.status !== "approved") {
    return NextResponse.json({ error: "Propunere negăsită" }, { status: 404 });
  }

  // Toggle: există deja votul?
  const { data: existing } = await admin
    .from("bp_voturi")
    .select("id")
    .eq("propunere_id", prop.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("bp_voturi").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Eroare la retragere" }, { status: 500 });
    return NextResponse.json({ ok: true, voted: false });
  }

  // Plafonul k-approval: max 3 voturi active pe propunerile din ACELAȘI oraș.
  const { data: countyProps } = await admin
    .from("bp_propuneri")
    .select("id")
    .eq("county", prop.county)
    .eq("status", "approved");
  const ids = (countyProps ?? []).map((p) => p.id);
  const { count } = await admin
    .from("bp_voturi")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("propunere_id", ids);
  if ((count ?? 0) >= MAX_VOTURI_PER_ORAS) {
    return NextResponse.json(
      { error: `Ai deja ${MAX_VOTURI_PER_ORAS} voturi active în acest oraș. Retrage unul ca să votezi altă prioritate.` },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("bp_voturi")
    .insert({ propunere_id: prop.id, user_id: user.id });
  if (error) {
    Sentry.captureException(error, { tags: { kind: "bp_vot_insert" } });
    return NextResponse.json({ error: "Eroare la vot" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, voted: true });
}
