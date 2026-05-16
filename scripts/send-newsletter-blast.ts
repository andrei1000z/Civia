/**
 * One-shot newsletter blast — trimite un email de „re-engagement" la
 * toți abonații (cont opt-in + anonim public).
 *
 * Usage:
 *   npx tsx scripts/send-newsletter-blast.ts preview    # afișează in terminal, NU trimite
 *   npx tsx scripts/send-newsletter-blast.ts test you@mail.com  # trimite doar la un test address
 *   npx tsx scripts/send-newsletter-blast.ts send       # trimite la TOȚI abonații
 *
 * Sursele de date:
 *   - profiles.newsletter_email_optin = true
 *   - newsletter_subscribers (anonim public, unsubscribed_at IS NULL)
 *
 * De-dup pe email.
 */

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { sendEmail, emailTemplate, emailNoteCallout } from "../src/lib/email/resend";
import { createSupabaseAdmin } from "../src/lib/supabase/admin";
import { Redis } from "@upstash/redis";

// Manual Redis instantiation — module-level analyticsRedis se citeste
// la import time, INAINTE ca dotenv config() sa populeze process.env.
// Aici cream client-ul DUPA ce config() a rulat.
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const MODE = process.argv[2] ?? "preview";
const TEST_TO = process.argv[3];

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

interface LiveStats {
  sesizari: number;
  petitii: number;
}

async function fetchLiveStats(): Promise<LiveStats> {
  const admin = createSupabaseAdmin();
  const [sez, pet] = await Promise.all([
    admin
      .from("sesizari")
      .select("id", { count: "exact", head: true })
      .eq("publica", true)
      .eq("moderation_status", "approved"),
    admin
      .from("petitii")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);
  return {
    sesizari: sez.count ?? 0,
    petitii: pet.count ?? 0,
  };
}

function buildBody(stats: LiveStats): string {
  return `
    <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#0f172a;">
      Pe Civia se mișcă lucrurile. Pe scurt:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 28px 0;">
      <tr>
        <td style="width:48%;padding:16px 8px;text-align:center;background:#ecfdf5;border-radius:12px;">
          <div style="font-size:32px;font-weight:800;color:#047857;line-height:1;">${stats.sesizari}</div>
          <div style="font-size:11px;font-weight:600;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">sesizări</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:48%;padding:16px 8px;text-align:center;background:#f5f3ff;border-radius:12px;">
          <div style="font-size:32px;font-weight:800;color:#6d28d9;line-height:1;">${stats.petitii}</div>
          <div style="font-size:11px;font-weight:600;color:#5b21b6;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">petiții active</div>
        </td>
      </tr>
    </table>

    <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:#0f172a;">Vezi o problemă pe stradă?</h3>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">
      Groapă, trotuar stricat, parcare ilegală, gunoi necolectat, montare stâlpișori — descrii într-o frază, atașezi o poză și formularul ajunge la primăria competentă cu temei legal complet.
    </p>
    <p style="margin:0 0 28px 0;">
      <a href="${SITE_URL}/sesizari" style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">Trimite o sesizare →</a>
    </p>

    <h3 style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:#0f172a;">Petiții civice</h3>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">
      ${stats.petitii} cauze active pe care le poți semna acum.
    </p>
    <p style="margin:0 0 28px 0;">
      <a href="${SITE_URL}/petitii" style="color:#059669;font-size:15px;font-weight:600;text-decoration:underline;">Vezi petițiile →</a>
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />

    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#334155;">
      Mai sunt: <a href="${SITE_URL}/intreruperi" style="color:#059669;text-decoration:underline;">întreruperi planificate</a> (apă, gaz, curent),
      <a href="${SITE_URL}/stiri" style="color:#059669;text-decoration:underline;">știri civice</a> cu sinteză AI,
      <a href="${SITE_URL}/ghiduri" style="color:#059669;text-decoration:underline;">ghiduri practice</a> (contestare amendă, Legea 544, ghid cutremur)
      și <a href="${SITE_URL}/sesizari-publice" style="color:#059669;text-decoration:underline;">sesizările publice</a> pe care le poți vota și co-semna.
    </p>

    <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
      Urmărește pe
      <a href="https://bsky.app/profile/civiaro.bsky.social" style="color:#059669;text-decoration:underline;">Bluesky</a>
      sau
      <a href="https://eyou.social/u/civia" style="color:#059669;text-decoration:underline;">eYou</a>.
    </p>
  `;
}

async function getAllSubscribers(): Promise<{ email: string; source: "cont" | "anonim" }[]> {
  const admin = createSupabaseAdmin();
  const [profilesRes, anonRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, newsletter_email_optin")
      .eq("newsletter_email_optin", true),
    admin
      .from("newsletter_subscribers")
      .select("email, unsubscribed_at, confirmed_at")
      .is("unsubscribed_at", null)
      .not("confirmed_at", "is", null),
  ]);

  // Pentru profiluri, trebuie email din auth.users
  const profileIds = (profilesRes.data ?? []).map((p) => p.id);
  let profileEmails: string[] = [];
  if (profileIds.length > 0) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    profileEmails = (users?.users ?? [])
      .filter((u) => profileIds.includes(u.id) && u.email)
      .map((u) => u.email as string);
  }

  const result: { email: string; source: "cont" | "anonim" }[] = [];
  const seen = new Set<string>();

  for (const e of profileEmails) {
    const k = e.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    result.push({ email: e, source: "cont" });
  }
  for (const row of anonRes.data ?? []) {
    if (!row.email) continue;
    const k = row.email.toLowerCase().trim();
    if (seen.has(k)) continue;
    seen.add(k);
    result.push({ email: row.email, source: "anonim" });
  }

  // Fallback Redis — daca Supabase insert a esuat silent, abonatii apar
  // doar in Redis (oglindit din /api/newsletter pentru admin dashboard).
  // Citim cheia civia:newsletter:subscribers (LIST de JSON entries).
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.lrange("civia:newsletter:subscribers", 0, 999);
      for (const item of raw ?? []) {
        try {
          const parsed = typeof item === "string" ? JSON.parse(item) : item;
          const email = (parsed?.email ?? "").toString().trim();
          if (!email) continue;
          const k = email.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          result.push({ email, source: "anonim" });
        } catch {
          // Item corupt — skip
        }
      }
    } catch (e) {
      console.warn("[redis fallback] failed:", (e as Error).message);
    }
  }

  return result;
}

async function main() {
  const stats = await fetchLiveStats();
  const subject = `Civia: ${stats.sesizari} sesizări, ${stats.petitii} petiții active`;
  const preheader = `${stats.sesizari} sesizări trimise · ${stats.petitii} petiții active. Vezi ce se mișcă.`;
  const bodyHtml = buildBody(stats);
  const html = emailTemplate({
    title: "Ce se mișcă pe Civia",
    kicker: "CIVIA · UPDATE",
    preheader,
    body: bodyHtml,
    ctaText: "Trimite o sesizare",
    ctaUrl: `${SITE_URL}/sesizari`,
  });

  if (MODE === "preview") {
    console.log("════════════════════════════════════════════════════════════════");
    console.log("📧 NEWSLETTER PREVIEW — NU SE TRIMITE NIMIC");
    console.log("════════════════════════════════════════════════════════════════\n");
    console.log("SUBJECT:", subject);
    console.log("PREHEADER:", preheader);
    console.log("\n──── DESTINATARI (extras din DB) ────\n");
    const subs = await getAllSubscribers();
    subs.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.email}  [${s.source}]`);
    });
    console.log(`\n  Total: ${subs.length} unici`);
    console.log("\n──── HTML (truncat la 800 char) ────\n");
    console.log(html.slice(0, 800) + "...\n");
    console.log("══════════════════════════════════════════════════════════");
    console.log("Pentru test cu un destinatar real:");
    console.log("  npx tsx scripts/send-newsletter-blast.ts test <email>");
    console.log("\nPentru blast la toți:");
    console.log("  npx tsx scripts/send-newsletter-blast.ts send");
    console.log("══════════════════════════════════════════════════════════");
    return;
  }

  if (MODE === "test") {
    if (!TEST_TO) {
      console.error("Usage: npx tsx scripts/send-newsletter-blast.ts test <email>");
      process.exit(1);
    }
    console.log(`📨 Sending TEST to ${TEST_TO}...`);
    await sendEmail({ to: TEST_TO, subject, html });
    console.log("✓ Sent.");
    return;
  }

  if (MODE === "send") {
    const subs = await getAllSubscribers();
    console.log(`📨 Sending to ${subs.length} subscribers...`);
    let ok = 0;
    let fail = 0;
    for (const s of subs) {
      try {
        await sendEmail({ to: s.email, subject, html });
        ok += 1;
        console.log(`  ✓ ${s.email}`);
        // Rate-limit: Resend free tier are 10 emails/sec. Pauzăm 200ms.
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        fail += 1;
        console.error(`  ✗ ${s.email}: ${(e as Error).message}`);
      }
    }
    console.log(`\nDone. ${ok} sent, ${fail} failed.`);
    return;
  }

  console.error(`Unknown mode: ${MODE}`);
  console.error("Use: preview | test <email> | send");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
