import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DAY=86400000, now=Date.now();
const c90=new Date(now-90*DAY).toISOString(), c1y=new Date(now-365*DAY).toISOString(), c3y=new Date(now-3*365*DAY).toISOString();

// (a) sesizări „expirate" pt PII co-semnatari
const closed = (await a.from("sesizari").select("id").in("status",["rezolvat","respins"]).lt("created_at",c90)).data ?? [];
const old = (await a.from("sesizari").select("id").lt("created_at",c1y)).data ?? [];
const ids = [...new Set([...closed,...old].map(r=>r.id))];
console.log(`sesizări expirate (închise>90z sau >1an): ${ids.length}`);
let cos=0;
if (ids.length) { const {count}=await a.from("sesizare_cosigners").select("id",{count:"exact",head:true}).in("sesizare_id",ids).or("email.not.is.null,ip_hash.not.is.null"); cos=count??0; }
console.log(`→ co-semnatari cu email/ip_hash de anonimizat: ${cos}`);

// (b) sesizări anonime >3 ani
const {count:anon} = await a.from("sesizari").select("id",{count:"exact",head:true}).lt("created_at",c3y).is("user_id",null).not("author_email","is",null);
console.log(`sesizări anonime >3 ani de anonimizat: ${anon??0}`);

// total cosigners cu PII (context)
const {count:totalPII} = await a.from("sesizare_cosigners").select("id",{count:"exact",head:true}).or("email.not.is.null,ip_hash.not.is.null");
const {count:noConsent} = await a.from("sesizare_cosigners").select("id",{count:"exact",head:true}).is("consent_at",null);
console.log(`\nContext: ${totalPII} co-semnatari cu PII total | ${noConsent} fără consent_at (legacy pre-checkbox)`);
