import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await admin.from("sesizari")
  .select("code, tip, titlu, locatie, status, author_email, author_name, created_at, sent_at, official_response, official_response_at, nr_inregistrare, sent_to_emails")
  .or("author_email.ilike.%musateduardandrei10%,locatie.ilike.%Ion Vlad%,titlu.ilike.%Ion Vlad%")
  .order("created_at", { ascending: false });
console.log(`Găsite (Ion Vlad / autor): ${data?.length ?? 0}`);
for (const s of data ?? []) {
  console.log(`\n[${s.code}] tip=${s.tip} STATUS=${s.status}`);
  console.log(`  titlu: ${s.titlu}`);
  console.log(`  loc: ${s.locatie}`);
  console.log(`  autor: ${s.author_name} <${s.author_email}>`);
  console.log(`  creat: ${s.created_at?.slice(0,10)} | sent_at: ${s.sent_at?.slice(0,16)}`);
  console.log(`  nr_inreg: ${s.nr_inregistrare} | resp_at: ${s.official_response_at}`);
  console.log(`  sent_to: ${JSON.stringify(s.sent_to_emails)}`);
}
