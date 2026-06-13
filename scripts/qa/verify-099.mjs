import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Tabelele există + sunt interogabile
const { error: asErr } = await admin.from("area_subscriptions").select("id", { count: "exact", head: true });
const { error: crErr } = await admin.from("cron_runs").select("job", { count: "exact", head: true });
console.log("area_subscriptions interogabil:", asErr ? "❌ " + asErr.message : "✅");
console.log("cron_runs interogabil:", crErr ? "❌ " + crErr.message : "✅");

// 2. INSERT real + dedup NULL-aware (al doilea insert identic trebuie să dea 23505)
const fakeUser = (await admin.from("profiles").select("id").limit(1).maybeSingle()).data?.id;
if (fakeUser) {
  const row = { user_id: fakeUser, email: "qa@civia.ro", county: "CJ", locality: null, category: null, consent_source: "api" };
  const r1 = await admin.from("area_subscriptions").insert(row).select("id").maybeSingle();
  console.log("insert #1 (CJ, tot județul):", r1.error ? "❌ " + r1.error.message : "✅ " + r1.data?.id);
  const r2 = await admin.from("area_subscriptions").insert(row);
  console.log("insert #2 identic → trebuie 23505 (dedup):", r2.error?.code === "23505" ? "✅ blocat corect" : "❌ " + (r2.error?.message ?? "permis duplicat!"));
  // CHECK constraint: county lowercase trebuie respins
  const rBad = await admin.from("area_subscriptions").insert({ ...row, county: "cj", locality: "x" });
  console.log("CHECK county uppercase (cj respins):", rBad.error ? "✅ respins" : "❌ a permis lowercase");
  // cleanup
  if (r1.data?.id) await admin.from("area_subscriptions").delete().eq("user_id", fakeUser).eq("email", "qa@civia.ro");
  console.log("cleanup QA rows: ✅");
}

// 3. cron_runs guard
const today = new Date().toISOString().slice(0,10);
const g1 = await admin.from("cron_runs").insert({ job: "qa-test", run_date: today });
const g2 = await admin.from("cron_runs").insert({ job: "qa-test", run_date: today });
console.log("cron_runs guard (a 2-a rulare azi → 23505):", g2.error?.code === "23505" ? "✅ idempotent" : "❌");
await admin.from("cron_runs").delete().eq("job", "qa-test");
