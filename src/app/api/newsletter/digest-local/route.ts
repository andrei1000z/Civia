import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailTemplate } from "@/lib/email/resend";
import { areaUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";
import {
  listAreaEmailSubscribers,
  areaLabel,
  countyName,
  countySlug,
  sectorFromLocality,
  type AreaSubscriber,
} from "@/lib/area/subscriptions";
import { getInterruptionsForCounty } from "@/lib/intreruperi/store";
import { SESIZARE_TIPURI } from "@/lib/constants";
import { escapeHtml } from "@/lib/sanitize";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Digest local săptămânal (Faza 2 — „Urmărește zona"). Marți, via /api/cron/daily.
 *
 * Pentru fiecare abonare email-activă, „Ce s-a întâmplat în {arie}": sesizări noi
 * + rezolvate (ultima săptămână) + întreruperi active. Colapsăm pe USER (un
 * singur email cu secțiuni multiple dacă cineva urmărește mai multe arii).
 *
 * Idempotență: guard cron_runs(job, run_date) → chiar dacă Vercel reîncearcă
 * marți, nu retrimitem. Auth: Bearer CRON_SECRET sau admin.
 */
const WEEK_MS = 7 * 24 * 60 * 60_000;

interface SesizareItem { code: string; titlu: string; locatie: string; tip: string; status: string }
interface AreaContent {
  newItems: SesizareItem[];
  resolvedItems: SesizareItem[];
  interruptionsCount: number;
}

const tipIcon = (tip: string) => SESIZARE_TIPURI.find((t) => t.value === tip)?.icon ?? "📮";

async function buildAreaContent(
  admin: ReturnType<typeof createSupabaseAdmin>,
  area: { county: string; locality: string | null; category: string | null },
  weekAgoIso: string,
): Promise<AreaContent> {
  const sector = sectorFromLocality(area.locality);

  const base = () => {
    let q = admin
      .from("sesizari")
      .select("code, titlu, locatie, tip, status")
      .eq("moderation_status", "approved")
      .eq("publica", true)
      .eq("county", area.county);
    if (sector) q = q.eq("sector", sector);
    else if (area.locality) q = q.ilike("locatie", `%${area.locality}%`);
    if (area.category) q = q.eq("tip", area.category);
    return q;
  };

  const [newRes, resolvedRes, interruptions] = await Promise.all([
    base().gte("created_at", weekAgoIso).order("created_at", { ascending: false }).limit(5),
    base().eq("status", "rezolvat").gte("resolved_at", weekAgoIso).order("resolved_at", { ascending: false }).limit(5),
    getInterruptionsForCounty(area.county).catch(() => []),
  ]);

  const now = Date.now();
  const activeInterruptions = (interruptions ?? []).filter(
    (i) => i.status !== "anulat" && i.status !== "finalizat" && new Date(i.endAt).getTime() > now,
  );

  return {
    newItems: (newRes.data ?? []) as SesizareItem[],
    resolvedItems: (resolvedRes.data ?? []) as SesizareItem[],
    interruptionsCount: activeInterruptions.length,
  };
}

function renderList(items: SesizareItem[], siteUrl: string): string {
  return items
    .map(
      (s) => `
      <li style="padding:10px 0;border-bottom:1px solid #e2e8f0">
        <div style="font-weight:600;color:#0f172a;font-size:14px">${tipIcon(s.tip)} ${escapeHtml(s.titlu)}</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px">📍 ${escapeHtml(s.locatie)} · ${escapeHtml(s.status)}</div>
        <a href="${siteUrl}/sesizari/${s.code}" style="color:#1C4ED8;font-size:12px;text-decoration:none">Vezi sesizarea →</a>
      </li>`,
    )
    .join("");
}

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

  // Idempotență — guard anti-dublă-trimitere la retry cron.
  const today = new Date().toISOString().slice(0, 10);
  const { error: guardErr } = await admin.from("cron_runs").insert({ job: "digest-local", run_date: today });
  if (guardErr && (guardErr as { code?: string }).code === "23505") {
    return NextResponse.json({ ok: true, skipped: "already ran today" });
  }

  const subscribers = await listAreaEmailSubscribers(admin);
  if (subscribers.length === 0) return NextResponse.json({ ok: true, sent: 0, subscribers: 0 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";
  const weekAgoIso = new Date(Date.now() - WEEK_MS).toISOString();

  // Conținut per arie unică (cache — nu recalculăm pentru aceeași arie).
  const areaKey = (s: { county: string; locality: string | null; category: string | null }) =>
    `${s.county}|${s.locality ?? ""}|${s.category ?? ""}`;
  const contentCache = new Map<string, AreaContent>();
  const uniqueAreas = new Map<string, AreaSubscriber>();
  for (const s of subscribers) uniqueAreas.set(areaKey(s), s);
  for (const [key, area] of uniqueAreas) {
    contentCache.set(key, await buildAreaContent(admin, area, weekAgoIso));
  }

  // Colapsare pe USER: un singur email cu o secțiune per arie.
  const byEmail = new Map<string, AreaSubscriber[]>();
  for (const s of subscribers) {
    const arr = byEmail.get(s.email) ?? [];
    arr.push(s);
    byEmail.set(s.email, arr);
  }

  const recipients = [...byEmail.entries()];

  const sendOne = async ([email, subs]: [string, AreaSubscriber[]]): Promise<boolean> => {
    const seenCodes = new Set<string>();
    const sections: string[] = [];

    for (const sub of subs) {
      const content = contentCache.get(areaKey(sub));
      if (!content) continue;
      // Dedup pe cod între ariile suprapuse ale aceluiași user.
      const newItems = content.newItems.filter((s) => !seenCodes.has(s.code));
      newItems.forEach((s) => seenCodes.add(s.code));
      const resolvedItems = content.resolvedItems.filter((s) => !seenCodes.has(s.code));
      resolvedItems.forEach((s) => seenCodes.add(s.code));

      if (newItems.length === 0 && resolvedItems.length === 0 && content.interruptionsCount === 0) {
        continue; // arie fără noutăți → fără secțiune
      }

      const unsubUrl = areaUnsubscribeUrl(email, sub.id, siteUrl);
      sections.push(`
        <div style="margin:0 0 28px">
          <h2 style="font-size:18px;margin:0 0 10px;color:#0f172a">📍 ${escapeHtml(areaLabel(sub))}</h2>
          ${newItems.length > 0 ? `
            <h3 style="font-size:14px;margin:14px 0 6px;color:#0f172a">Sesizări noi</h3>
            <ul style="margin:0;padding-left:0;list-style:none">${renderList(newItems, siteUrl)}</ul>` : ""}
          ${resolvedItems.length > 0 ? `
            <h3 style="font-size:14px;margin:16px 0 6px;color:#059669">🎉 Rezolvate</h3>
            <ul style="margin:0;padding-left:0;list-style:none">${renderList(resolvedItems, siteUrl)}</ul>` : ""}
          ${content.interruptionsCount > 0 ? `
            <p style="margin:12px 0 0;font-size:13px;color:#b45309">⚡ ${content.interruptionsCount} ${content.interruptionsCount === 1 ? "întrerupere activă" : "întreruperi active"} în ${escapeHtml(countyName(sub.county))} — <a href="${siteUrl}/intreruperi/${countySlug(sub.county)}" style="color:#1C4ED8;text-decoration:none">vezi →</a></p>` : ""}
          <p style="margin:10px 0 0;font-size:11px;color:#94a3b8">
            <a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline">Nu mai urmări ${escapeHtml(areaLabel(sub))}</a>
          </p>
        </div>`);
    }

    if (sections.length === 0) return false; // nimic nou în niciuna din arii → skip

    const primaryArea = areaLabel(subs[0]!);
    const html = emailTemplate({
      title: `Ce s-a întâmplat în ${primaryArea}`,
      preheader: `Activitatea civică din zona ta pe Civia, ultima săptămână`,
      body: `
        <p style="color:#64748b;margin:0 0 20px;line-height:1.6">Iată ce s-a întâmplat în zona pe care o urmărești, în ultimele 7 zile.</p>
        ${sections.join("")}
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center">Gestionează toate zonele urmărite din <a href="${siteUrl}/cont" style="color:#94a3b8;text-decoration:underline">contul tău</a>.</p>`,
      ctaText: "Fă o sesizare în zona ta",
      ctaUrl: `${siteUrl}/sesizari`,
    });

    const result = await sendEmail({
      to: email,
      subject: `Ce s-a întâmplat în ${primaryArea} — Civia`,
      html,
      listUnsubscribe: areaUnsubscribeUrl(email, subs[0]!.id, siteUrl),
    });
    return result.ok;
  };

  let sent = 0;
  let failed = 0;
  const CHUNK = 8;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const group = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(group.map(sendOne));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent++;
      else {
        if (r.status === "fulfilled" && !r.value) { /* skip = arie goală */ }
        else { failed++; if (r.status === "rejected") Sentry.captureException(r.reason, { tags: { route: "digest-local" } }); }
      }
    }
    if (i + CHUNK < recipients.length) await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ ok: true, sent, failed, recipients: recipients.length, areas: uniqueAreas.size });
}
