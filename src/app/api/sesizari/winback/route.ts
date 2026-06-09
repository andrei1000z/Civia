import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { newsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";
import { ALL_COUNTIES } from "@/data/counties";
import { SESIZARE_TIPURI } from "@/lib/constants";
import { escapeHtml } from "@/lib/sanitize";
import { isWinbackEligible } from "@/lib/sesizari/winback";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Win-back a-doua-acțiune (Faza 1) — chaser la 48h.
 *
 * Pentru cetățenii care au depus PRIMA sesizare acum ~48h și NU au mai făcut o
 * a doua acțiune (o singură sesizare, zero comentarii, zero co-semnături), trimite
 * un email „Vezi ce s-a mai raportat în {oraș}" cu 3 sesizări apropiate. A doua
 * acțiune e cea mai ieftină sursă de retenție.
 *
 * DEDUP fără tabel de log: fereastra [now-72h, now-48h) e largă de 24h și cronul
 * zilnic (/api/cron/daily) o atinge o singură dată per sesizare → fiecare user
 * primește chaser-ul exact o dată, în ziua în care prima lui sesizare împlinește
 * ~48h.
 *
 * GDPR: trimitem DOAR userilor cu newsletter_email_optin = true (același
 * consimțământ ca digestul săptămânal — update de activitate civică).
 *
 * Auth: Bearer ${CRON_SECRET} (cron) sau admin session.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;
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
  const now = Date.now();
  const since72 = new Date(now - 72 * 60 * 60_000).toISOString();
  const since48 = new Date(now - 48 * 60 * 60_000).toISOString();

  // 1) Sesizări candidate: depuse în fereastra [now-72h, now-48h), de useri logați.
  const { data: candRows, error: candErr } = await admin
    .from("sesizari")
    .select("code, titlu, county, author_email, user_id, created_at")
    .not("user_id", "is", null)
    .gte("created_at", since72)
    .lt("created_at", since48)
    .limit(400);
  if (candErr) {
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }

  type Cand = { code: string; titlu: string; county: string | null; author_email: string | null; user_id: string; created_at: string };
  const candidates = ((candRows ?? []) as Cand[]).filter((c) => c.author_email);
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, candidates: 0 });
  }

  const userIds = [...new Set(candidates.map((c) => c.user_id))];

  // 2) Interogări BATCH (4 total, nu N×4) ca să verificăm „fără a doua acțiune"
  //    + consimțământ, fără a interoga per-user.
  const [allSesizariRes, commentsRes, cosignersRes, profilesRes] = await Promise.all([
    admin.from("sesizari").select("user_id").in("user_id", userIds),
    admin.from("sesizare_comments").select("user_id").in("user_id", userIds),
    admin.from("sesizare_cosigners").select("user_id").in("user_id", userIds),
    admin.from("profiles").select("id, newsletter_email_optin").in("id", userIds).eq("newsletter_email_optin", true),
  ]);

  const countBy = (rows: { user_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.user_id) continue;
      m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    }
    return m;
  };
  const sesizariCount = countBy(allSesizariRes.data as { user_id: string | null }[]);
  const commentsCount = countBy(commentsRes.data as { user_id: string | null }[]);
  const cosignersCount = countBy(cosignersRes.data as { user_id: string | null }[]);
  const consented = new Set(((profilesRes.data ?? []) as { id: string }[]).map((p) => p.id));

  // 3) Filtrăm: o singură sesizare, zero comentarii, zero co-semnături, consimțit.
  const eligible = candidates.filter((c) =>
    isWinbackEligible(
      {
        sesizari: sesizariCount.get(c.user_id) ?? 0,
        comments: commentsCount.get(c.user_id) ?? 0,
        cosigners: cosignersCount.get(c.user_id) ?? 0,
      },
      consented.has(c.user_id),
    ),
  );
  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, candidates: candidates.length });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
  const countyName = (id: string | null) => ALL_COUNTIES.find((c) => c.id === id)?.name ?? "zona ta";
  const tipIcon = (tip: string) => SESIZARE_TIPURI.find((t) => t.value === tip)?.icon ?? "📮";

  // 4) Pentru fiecare eligibil: 3 sesizări apropiate (același județ, publice, nu ale lui).
  const sendOne = async (c: Cand): Promise<boolean> => {
    let nearbyQuery = admin
      .from("sesizari")
      .select("code, titlu, tip, locatie, status")
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .neq("user_id", c.user_id)
      .order("created_at", { ascending: false })
      .limit(3);
    if (c.county) nearbyQuery = nearbyQuery.eq("county", c.county);
    const { data: nearby } = await nearbyQuery;
    const items = (nearby ?? []) as Array<{ code: string; titlu: string; tip: string; locatie: string; status: string }>;
    if (items.length === 0) return false; // nimic de arătat → nu trimitem un email gol

    const oras = countyName(c.county);
    const unsubUrl = newsletterUnsubscribeUrl(c.author_email!, siteUrl);
    const list = items
      .map(
        (s) => `
        <li style="padding:12px 0;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:600;color:#0f172a;font-size:14px">${tipIcon(s.tip)} ${escapeHtml(s.titlu)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:2px">📍 ${escapeHtml(s.locatie)} · ${escapeHtml(s.status)}</div>
          <a href="${siteUrl}/sesizari/${s.code}" style="color:#1C4ED8;font-size:12px;text-decoration:none">Vezi sesizarea →</a>
        </li>`,
      )
      .join("");

    const body = `
      <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a">Ce s-a mai raportat în ${escapeHtml(oras)}</h2>
      <p style="color:#64748b;margin:0 0 20px;line-height:1.6">
        Ai depus prima ta sesizare acum câteva zile — mulțumim! Iată ce au mai
        semnalat alți cetățeni din zona ta. Poți co-semna cu un click ca să crești
        presiunea, sau să depui o sesizare nouă.
      </p>
      <ul style="margin:0 0 24px;padding-left:0;list-style:none">${list}</ul>
      <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center">
        Primești acest email pentru că ești abonat la actualizările civice Civia.
        <a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline">Dezabonează-te</a>.
      </p>`;

    const html = emailTemplate({
      title: `Ce s-a mai raportat în ${oras}`,
      preheader: `${items.length} sesizări noi din zona ta pe Civia`,
      body,
      ctaText: "Vezi sesizările din zona ta",
      ctaUrl: `${siteUrl}/sesizari-publice`,
    });

    const result = await sendEmail({
      to: c.author_email!,
      subject: `Ce s-a mai raportat în ${oras} — Civia`,
      html,
      listUnsubscribe: unsubUrl,
    });
    return result.ok;
  };

  // Cap la 200 + loturi paralele (≤ ~10/s free tier Resend).
  const toSend = eligible.slice(0, 200);
  let sent = 0;
  let failed = 0;
  const CHUNK = 8;
  for (let i = 0; i < toSend.length; i += CHUNK) {
    const group = toSend.slice(i, i + CHUNK);
    const results = await Promise.allSettled(group.map(sendOne));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else {
        failed++;
        if (r.status === "rejected") {
          Sentry.captureException(r.reason, { tags: { route: "sesizari.winback" } });
        }
      }
    }
    if (i + CHUNK < toSend.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ ok: true, sent, failed, eligible: eligible.length, candidates: candidates.length });
}
