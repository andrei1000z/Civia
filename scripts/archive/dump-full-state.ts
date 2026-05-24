/**
 * Dump COMPLET al stării Supabase pentru analiză end-to-end.
 * Listează: toate tabelele, conturi count, sesizări (deja avem), petiții,
 * proteste, știri, comments, votes, follows, replies, newsletter,
 * intreruperi, ghiduri, autorități, profiles, evenimente, drafts.
 *
 * Format: secțiuni per tabel cu count + sample 3 row-uri + agregate.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const LINE = "═".repeat(100);
const SUB = "─".repeat(100);

async function section(name: string, fn: () => Promise<void>) {
  console.log(`\n${LINE}\n${name}\n${LINE}`);
  try {
    await fn();
  } catch (e) {
    console.log(`  ❌ Eroare: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function dumpTable(name: string, opts?: { sample?: number; orderBy?: string; selectFields?: string }) {
  const sample = opts?.sample ?? 3;
  const orderBy = opts?.orderBy ?? "created_at";
  const fields = opts?.selectFields ?? "*";

  const countQuery = await sa.from(name).select("*", { count: "exact", head: true });
  if (countQuery.error) {
    console.log(`  ❌ ${name}: ${countQuery.error.message}`);
    return;
  }
  console.log(`  📊 ${name}: ${countQuery.count} rows`);

  if ((countQuery.count ?? 0) > 0 && sample > 0) {
    let q = sa.from(name).select(fields);
    try {
      q = q.order(orderBy, { ascending: false });
    } catch { /* table might not have created_at */ }
    const { data } = await q.limit(sample);
    for (let i = 0; i < (data ?? []).length; i++) {
      console.log(`    Sample #${i + 1}:`, JSON.stringify(data?.[i], null, 0).slice(0, 400));
    }
  }
}

async function main() {
  console.log("📦 CIVIA FULL DB STATE DUMP");
  console.log(`Generated: ${new Date().toISOString()}\n`);

  await section("👥 PROFILES & ACCOUNTS", async () => {
    await dumpTable("profiles", { sample: 5 });
    const { data: roleStats } = await sa.from("profiles").select("role");
    const roleMap = new Map<string, number>();
    for (const r of (roleStats ?? []) as Array<{ role: string }>) {
      roleMap.set(r.role ?? "(null)", (roleMap.get(r.role ?? "(null)") ?? 0) + 1);
    }
    console.log("  📈 Roles:", JSON.stringify(Object.fromEntries(roleMap)));

    const { count: streaks } = await sa
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gt("civic_streak_days", 0);
    console.log(`  🔥 Active civic streaks: ${streaks ?? 0}`);
  });

  await section("📋 SESIZARI (compact agregate)", async () => {
    await dumpTable("sesizari", { sample: 0 });
    const { data: rows } = await sa
      .from("sesizari")
      .select("status, publica, moderation_status, sent_via_civia, delivery_status");
    const statusMap = new Map<string, number>();
    const deliveryMap = new Map<string, number>();
    let sent = 0;
    let publica = 0;
    let pending = 0;
    for (const r of (rows ?? []) as Array<{ status: string; publica: boolean; moderation_status: string; sent_via_civia: boolean; delivery_status: string | null }>) {
      statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
      const ds = r.delivery_status ?? "(null)";
      deliveryMap.set(ds, (deliveryMap.get(ds) ?? 0) + 1);
      if (r.sent_via_civia) sent += 1;
      if (r.publica) publica += 1;
      if (r.moderation_status === "pending") pending += 1;
    }
    console.log("  📈 Status:", JSON.stringify(Object.fromEntries(statusMap)));
    console.log("  📈 Delivery:", JSON.stringify(Object.fromEntries(deliveryMap)));
    console.log(`  📈 Sent via Civia: ${sent}, Publice: ${publica}, Pending mod: ${pending}`);
  });

  await section("💬 SESIZARE INTERACTIONS", async () => {
    await dumpTable("sesizare_votes", { sample: 0 });
    await dumpTable("sesizare_comments", { sample: 2 });
    await dumpTable("sesizare_follows", { sample: 0 });
    await dumpTable("sesizare_cosigners", { sample: 0 });
    await dumpTable("sesizare_verifications", { sample: 0 });
    await dumpTable("sesizare_timeline", { sample: 0 });
    const { data: tlBreak } = await sa.from("sesizare_timeline").select("event_type");
    const tlMap = new Map<string, number>();
    for (const r of (tlBreak ?? []) as Array<{ event_type: string }>) {
      tlMap.set(r.event_type, (tlMap.get(r.event_type) ?? 0) + 1);
    }
    console.log("  📈 Timeline events:", JSON.stringify(Object.fromEntries(tlMap)));
    await dumpTable("sesizare_replies", { sample: 1 });
    await dumpTable("sesizari_reminders", { sample: 0 });
    await dumpTable("sesizare_status_tickets", { sample: 0 });
    await dumpTable("sesizari_drafts", { sample: 0 });
    await dumpTable("sesizari_pattern_clusters", { sample: 0 });
  });

  await section("📜 PETITII", async () => {
    await dumpTable("petitii", { sample: 3 });
    await dumpTable("petitie_semnaturi", { sample: 0, orderBy: "signed_at" });
    await dumpTable("petitie_updates", { sample: 0 });
  });

  await section("📢 PROTESTE", async () => {
    await dumpTable("proteste", { sample: 3, orderBy: "date_start" });
    await dumpTable("proteste_actualizari", { sample: 0 });
  });

  await section("📰 STIRI", async () => {
    await dumpTable("stiri", { sample: 2 });
    const { data: stiri } = await sa.from("stiri").select("source, sentiment, ai_summary, published_at");
    const sourceMap = new Map<string, number>();
    const sentimentMap = new Map<string, number>();
    let withAi = 0;
    for (const r of (stiri ?? []) as Array<{ source: string; sentiment: string | null; ai_summary: string | null }>) {
      sourceMap.set(r.source ?? "(null)", (sourceMap.get(r.source ?? "(null)") ?? 0) + 1);
      sentimentMap.set(r.sentiment ?? "(null)", (sentimentMap.get(r.sentiment ?? "(null)") ?? 0) + 1);
      if (r.ai_summary) withAi += 1;
    }
    console.log("  📈 Sources:", JSON.stringify(Object.fromEntries([...sourceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))));
    console.log("  📈 Sentiment:", JSON.stringify(Object.fromEntries(sentimentMap)));
    console.log(`  📈 With AI summary: ${withAi}/${stiri?.length ?? 0}`);
  });

  await section("⚡ INTRERUPERI", async () => {
    await dumpTable("intreruperi", { sample: 2 });
    const { data: intr } = await sa.from("intreruperi").select("provider, type, status, county");
    const provMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    for (const r of (intr ?? []) as Array<{ provider: string; type: string }>) {
      provMap.set(r.provider ?? "(null)", (provMap.get(r.provider ?? "(null)") ?? 0) + 1);
      typeMap.set(r.type ?? "(null)", (typeMap.get(r.type ?? "(null)") ?? 0) + 1);
    }
    console.log("  📈 Providers:", JSON.stringify(Object.fromEntries(provMap)));
    console.log("  📈 Types:", JSON.stringify(Object.fromEntries(typeMap)));
  });

  await section("📅 EVENIMENTE", async () => {
    await dumpTable("evenimente", { sample: 2, orderBy: "starts_at" });
  });

  await section("🏛️ AUTORITĂȚI", async () => {
    await dumpTable("authorities", { sample: 3 });
    const { data: auth } = await sa.from("authorities").select("kind, verified");
    const kindMap = new Map<string, number>();
    let verified = 0;
    for (const r of (auth ?? []) as Array<{ kind: string; verified: boolean }>) {
      kindMap.set(r.kind, (kindMap.get(r.kind) ?? 0) + 1);
      if (r.verified) verified += 1;
    }
    console.log("  📈 Kinds:", JSON.stringify(Object.fromEntries(kindMap)));
    console.log(`  📈 Verified: ${verified}/${auth?.length ?? 0}`);
  });

  await section("📩 NEWSLETTER", async () => {
    await dumpTable("newsletter_subscribers", { sample: 0 });
    const { count: confirmed } = await sa
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("confirmed", true);
    console.log(`  📈 Confirmed: ${confirmed ?? 0}`);
  });

  await section("📊 ANALYTICS & TRACKING", async () => {
    await dumpTable("analytics_events", { sample: 0 });
    await dumpTable("inbox_debug_log", { sample: 0 });
    await dumpTable("feedback", { sample: 0 });
    await dumpTable("push_subscriptions", { sample: 0 });
  });

  await section("⚙️ OTHER TABLES", async () => {
    const otherTables = [
      "categorii_personalizate",
      "user_preferences",
      "stiri_cache",
      "civic_actions",
    ];
    for (const t of otherTables) {
      await dumpTable(t, { sample: 0 });
    }
  });

  console.log("\n✨ Done. Full state dumped.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
