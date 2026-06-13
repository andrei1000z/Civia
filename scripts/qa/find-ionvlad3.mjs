import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await admin.from("sesizari")
  .select("code, tip, titlu, locatie, status, author_email, created_at, sent_at, nr_inregistrare, official_response_at")
  .or("locatie.ilike.%Ion Vlad%,titlu.ilike.%Ion Vlad%,descriere.ilike.%Ion Vlad%")
  .order("created_at", { ascending: true });
console.log(`Ion Vlad matches: ${data?.length ?? 0}`);
for (const s of data ?? []) {
  console.log(`\n[${s.code}] tip=${s.tip} STATUS=${s.status} creat=${s.created_at?.slice(0,10)} sent=${s.sent_at?.slice(0,10)}`);
  console.log(`  titlu: ${s.titlu}`);
  console.log(`  loc: ${s.locatie}`);
  console.log(`  autor: ${s.author_email} | nr_inreg: ${s.nr_inregistrare}`);
}
// Și verific replies în inbox legate de Ion Vlad / Administratia Strazilor / 16583
const { data: replies } = await admin.from("sesizare_replies")
  .select("id, sesizare_id, ai_status, ai_nr_inregistrare, ai_summary, from_email, created_at, match_method")
  .or("ai_summary.ilike.%Ion Vlad%,ai_nr_inregistrare.ilike.%16583%,ai_summary.ilike.%stalpisor%")
  .order("created_at", { ascending: false }).limit(5);
console.log(`\n\n=== Replies inbox legate ===  (${replies?.length ?? 0})`);
for (const r of replies ?? []) {
  console.log(`[reply ${r.id?.slice(0,8)}] sesizare_id=${r.sesizare_id?.slice(0,8)} ai_status=${r.ai_status} nr=${r.ai_nr_inregistrare} from=${r.from_email}`);
  console.log(`  summary: ${(r.ai_summary||"").slice(0,120)}`);
}
