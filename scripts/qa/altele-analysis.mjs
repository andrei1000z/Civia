import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Toate sesizările cu tip='altele' + custom_category
const { data } = await admin.from("sesizari")
  .select("code, titlu, custom_category, locatie, descriere, status, created_at")
  .eq("tip", "altele")
  .order("created_at", { ascending: false });

console.log(`Total sesizări 'altele': ${data?.length ?? 0}\n`);
// Distribuție pe custom_category
const dist = new Map();
for (const s of data ?? []) {
  const k = (s.custom_category || "(fără)").trim();
  dist.set(k, (dist.get(k) ?? 0) + 1);
}
console.log("=== Distribuție custom_category (count) ===");
for (const [k, n] of [...dist.entries()].sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${n}× ${k}`);
}
console.log("\n=== Detalii per sesizare ===");
for (const s of data ?? []) {
  console.log(`\n[${s.code}] „${s.custom_category}" (${s.status})`);
  console.log(`   titlu: ${s.titlu}`);
  console.log(`   loc: ${s.locatie}`);
  console.log(`   desc: ${(s.descriere||"").slice(0,140)}`);
}
