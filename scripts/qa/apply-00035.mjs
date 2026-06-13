import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: ses } = await admin.from("sesizari").select("id, code, status, titlu").eq("code", "00035").maybeSingle();
if (!ses) { console.log("❌ 00035 negăsită"); process.exit(1); }
console.log(`Sesizare ${ses.code} (${ses.id.slice(0,8)}) status curent: ${ses.status}`);

const officialResponse = `Administrația Străzilor București (înregistrare nr. 16583/18.05.2026): propunerea de instalare a stâlpișorilor de protecție pe trotuar pe Strada Ion Vlad a fost AVIZATĂ favorabil de Comisia Tehnică de Circulație (ședința 11.11.2025, poz. 34), împreună cu restricția „Oprirea interzisă" (avizată 04.03.2021, poz. 17). Dosarul a fost transmis Primăriei Sectorului 2 pentru materializare, însoțit de schițe.`;

const now = new Date().toISOString();
const { error: upErr } = await admin.from("sesizari").update({
  status: "in-lucru",
  nr_inregistrare: "ASB 16583/18.05.2026",
  official_response: officialResponse,
  official_response_at: now,
  updated_at: now,
}).eq("id", ses.id);
if (upErr) { console.log("❌ update:", upErr.message); process.exit(1); }
console.log("✅ status → in-lucru, nr_inregistrare + official_response setate");

// Timeline event (dedup soft: doar dacă nu există deja un in-lucru recent)
const { error: tlErr } = await admin.from("sesizare_timeline").insert({
  sesizare_id: ses.id,
  event_type: "in-lucru",
  description: "Administrația Străzilor a avizat favorabil montarea stâlpișorilor + oprirea interzisă pe Str. Ion Vlad; transmis Primăriei Sector 2 pentru implementare.",
});
console.log(tlErr ? `⚠️ timeline: ${tlErr.message}` : "✅ eveniment timeline adăugat (in-lucru)");

// Verificare
const { data: after } = await admin.from("sesizari").select("status, nr_inregistrare, official_response_at").eq("id", ses.id).maybeSingle();
console.log("\nVERIFICARE:", JSON.stringify(after));
