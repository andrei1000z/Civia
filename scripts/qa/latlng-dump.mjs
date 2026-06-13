import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,county,locatie,lat,lng").not("lat","is",null).order("lat",{ascending:false});
console.log("=== sortate după LAT desc (nord/munți primele) ===");
for (const s of data) console.log(`${s.code} | ${s.lat.toFixed(4)},${s.lng.toFixed(4)} | ${s.county||'-'} | ${(s.locatie||'').slice(0,48)}`);
// coords duplicate
const m={}; for(const s of data){const k=`${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;(m[k]=m[k]||[]).push(s.code);}
const dups=Object.entries(m).filter(([,v])=>v.length>1);
console.log(`\nCOORDS DUPLICATE (același punct exact): ${dups.length}`);
for(const[k,v]of dups) console.log(`  ${k}: ${v.join(",")}`);
