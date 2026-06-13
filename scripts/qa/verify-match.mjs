import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// 00020 descriere completă (PDF7 Cotroceni?)
const { data: s20 } = await a.from("sesizari").select("code,locatie,descriere").eq("code","00020").single();
console.log(`00020 loc: ${s20.locatie}`);
console.log(`00020 desc: ${s20.descriere}\n`);
// care sesizări au emailul tău de test
const { data } = await a.from("sesizari").select("code,author_email,locatie,status").order("code");
const mine = data.filter(s => (s.author_email||'').toLowerCase().includes("musateduardandrei") || (s.author_email||'').toLowerCase().includes("musat"));
console.log(`Sesizări cu emailul Mușat (${mine.length}):`);
for (const s of mine) console.log(`  ${s.code} | ${s.status} | ${(s.locatie||'').slice(0,45)}`);
// distinct emails
const emails = {}; for (const s of data) emails[s.author_email||'(null)'] = (emails[s.author_email||'(null)']||0)+1;
console.log(`\nDistribuție emailuri:`, JSON.stringify(emails));
