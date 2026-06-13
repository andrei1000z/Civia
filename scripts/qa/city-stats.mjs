import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { extractLocality } from "../../src/lib/sesizari/extract-locality.ts";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await admin.from("sesizari").select("locatie, status").eq("moderation_status","approved").eq("publica",true).not("locatie","is",null);
const b = new Map();
let unmapped = 0;
for (const r of data ?? []) {
  const c = extractLocality(r.locatie);
  if (!c) { unmapped++; continue; }
  const e = b.get(c) ?? {t:0,r:0}; e.t++; if (r.status==="rezolvat") e.r++; b.set(c,e);
}
console.log("total public:", data?.length, "| nemapate (extractLocality null):", unmapped);
const top = [...b.entries()].map(([city,e])=>({city,total:e.t,resolved:e.r,fix:Math.round(e.r/e.t*100)})).filter(x=>x.total>=4).sort((a,b)=>b.fix-a.fix||b.total-a.total).slice(0,12);
console.log("orașe cu >=4 sesizări:", top.length);
for (const c of top) console.log(`  ${c.city}: ${c.fix}% (${c.resolved}/${c.total})`);
