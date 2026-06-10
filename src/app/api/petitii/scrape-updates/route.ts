/**
 * POST /api/petitii/scrape-updates — fetch + parse update-uri pentru toate
 * petițiile active cu external_url Declic. Insert idempotent via content_hash
 * unique constraint. Pentru fiecare update NOU, broadcast push notification.
 *
 * Auth: Bearer CRON_SECRET (pentru Vercel cron) sau admin session.
 *
 * Rulează zilnic via Vercel cron sau self-healing din /api/petitii GET.
 */
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";
import { after } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  scrapeDeclicUpdates,
  canScrapeUpdates,
} from "@/lib/petitii/updates-scraper";
import { broadcastToAllSubscribers } from "@/lib/push/web-push-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // sec — fetching ~50 petitii @ 1s each

async function authorize(req: Request): Promise<boolean> {
  // 1. Bearer CRON_SECRET
  const auth = req.headers.get("Authorization");
  if (auth && process.env.CRON_SECRET) {
    if (verifyBearer(auth, process.env.CRON_SECRET)) return true;
  }
  // 2. Admin session
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (profile as { role?: string } | null)?.role === "admin";
}

export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  // Listează petițiile cu external_url scrapeable + active.
  const { data: petitii, error: listErr } = await admin
    .from("petitii")
    .select("id, slug, title, external_url, updates_last_scraped_at")
    .eq("status", "active")
    .not("external_url", "is", null);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  let scraped = 0;
  let newUpdates = 0;
  let pushed = 0;
  const errors: Array<{ petitie_id: string; error: string }> = [];

  for (const p of petitii ?? []) {
    if (!canScrapeUpdates(p.external_url)) continue;
    scraped += 1;

    const { updates, signatureCount, error } = await scrapeDeclicUpdates(p.external_url!);

    // Marchează ts indiferent de rezultat (pentru retry logic ulterior).
    // 2026-06-06 (audit #5) — dacă am extras nr. de semnături din sursă, îl
    // salvăm (transparență: afișăm momentum-ul real pe card/detaliu).
    await admin
      .from("petitii")
      .update({
        updates_last_scraped_at: new Date().toISOString(),
        updates_last_scrape_error: error,
        ...(signatureCount !== null
          ? { external_signature_count: signatureCount, last_external_sync_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", p.id);

    if (error) {
      errors.push({ petitie_id: p.id, error });
      continue;
    }

    if (updates.length === 0) continue;

    // Insert cu ON CONFLICT DO NOTHING — Supabase nu suportă direct, deci
    // facem upsert cu ignoreDuplicates pe (petitie_id, content_hash).
    const rows = updates.map((u) => ({
      petitie_id: p.id,
      update_date: u.updateDate,
      title: u.title,
      body: u.body,
      content_hash: u.contentHash,
    }));

    const { data: inserted, error: insErr } = await admin
      .from("petitie_updates")
      .upsert(rows, {
        onConflict: "petitie_id,content_hash",
        ignoreDuplicates: true,
      })
      .select("id, title, update_date");

    if (insErr) {
      errors.push({ petitie_id: p.id, error: insErr.message });
      continue;
    }

    const reallyNew = inserted ?? [];
    newUpdates += reallyNew.length;

    // Pentru fiecare update nou, broadcast push notif. Fire-and-forget via
    // after() ca să nu blocheze response-ul cronului (fiecare push poate
    // dura câteva secunde).
    if (reallyNew.length > 0) {
      for (const u of reallyNew) {
        // Marchează push_notified=true ÎNAINTE să facem push (race-safe).
        await admin
          .from("petitie_updates")
          .update({ push_notified: true })
          .eq("id", u.id);

        pushed += 1;
        after(async () => {
          await broadcastToAllSubscribers({
            title: `📣 Update petiție: ${p.title}`,
            body: u.title.slice(0, 140),
            url: `/petitii/${p.slug}#updates`,
            tag: `petitie-update-${p.id}`,
            icon: "/icon-192.png",
          });
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scraped,
    newUpdates,
    pushed,
    errors,
  });
}

// GET pentru convenience — accept și GET cu același payload de auth.
export async function GET(req: Request) {
  return POST(req);
}
