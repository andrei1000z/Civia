import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyBearer } from "@/lib/auth/constant-time";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { PRIMARII } from "@/data/autoritati-contact";
import { countySeatName } from "@/lib/sesizari/authorities";
import {
  buildAdresaBP,
  SUBIECT_ADRESA_BP,
  MIN_PROPUNERI,
  MIN_VOTURI_TOTAL,
} from "@/lib/bugetare/transmitere";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Transmiterea formală a topului „Prioritățile orașului" către primării.
 * Rulat lunar (ziua 1) de dispecerul /api/cron/daily + apelabil manual de admin.
 *
 * Per județ cu propuneri aprobate:
 *  • prag anti-„cameră goală": ≥3 propuneri și ≥10 voturi în total — altfel sare;
 *  • idempotență: max 1 transmitere / 28 de zile / județ;
 *  • top 5 după voturi → adresă formală OG 27/2002 → email primăriei reședinței
 *    de județ (PRIMARII din autoritati-contact) + jurnal public bp_transmiteri.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const isCron = verifyBearer(auth, process.env.CRON_SECRET);
  if (!isCron) {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((prof as { role?: string } | null)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const admin = createSupabaseAdmin();
  const { data: all, error } = await admin
    .from("bp_propuneri")
    .select("id, county, titlu, descriere, categorie, votes_count")
    .eq("status", "approved");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCounty = new Map<string, NonNullable<typeof all>>();
  for (const p of all ?? []) {
    const arr = byCounty.get(p.county) ?? [];
    arr.push(p);
    byCounty.set(p.county, arr);
  }

  const results: Array<Record<string, unknown>> = [];
  const cutoff28d = new Date(Date.now() - 28 * 86_400_000).toISOString();

  for (const [county, props] of byCounty) {
    const totalVoturi = props.reduce((s, p) => s + p.votes_count, 0);
    if (props.length < MIN_PROPUNERI || totalVoturi < MIN_VOTURI_TOTAL) {
      results.push({ county, skipped: "sub prag", propuneri: props.length, voturi: totalVoturi });
      continue;
    }

    // Idempotență lunară.
    const { data: recent } = await admin
      .from("bp_transmiteri")
      .select("id")
      .eq("county", county)
      .gte("sent_at", cutoff28d)
      .limit(1);
    if (recent && recent.length > 0) {
      results.push({ county, skipped: "transmis recent" });
      continue;
    }

    const contact = PRIMARII[county];
    if (!contact?.email) {
      results.push({ county, skipped: "fără email primărie" });
      continue;
    }

    const oras = county === "B" ? "București" : countySeatName(county);
    const primarie = county === "B" ? "Primăria Municipiului București" : `Primăria ${oras}`;
    const top = [...props].sort((a, b) => b.votes_count - a.votes_count).slice(0, 5);
    const data = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
    const text = buildAdresaBP({ primarie, oras, top, totalVoturi, data });

    try {
      const sent = await sendEmail({
        to: contact.email,
        subject: SUBIECT_ADRESA_BP(oras),
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`,
      });
      await admin.from("bp_transmiteri").insert({
        county,
        recipients: [contact.email],
        total_votes: totalVoturi,
        propuneri_snapshot: top,
        resend_message_id: (sent as { id?: string } | null)?.id ?? null,
      });
      results.push({ county, sent: true, to: contact.email, top: top.length, voturi: totalVoturi });
    } catch (e) {
      Sentry.captureException(e, { tags: { kind: "bp_transmitere_failed" }, extra: { county } });
      results.push({ county, error: e instanceof Error ? e.message : "send failed" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
