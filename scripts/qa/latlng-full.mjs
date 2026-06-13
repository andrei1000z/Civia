import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
import { detectCountyFromLocatie } from "../../src/lib/sesizari/county-from-locatie.ts";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,county,sector,locatie,lat,lng").not("lat","is",null).order("lat",{ascending:false});
console.log("cod | lat,lng | county | det.locatie | locatie");
let mismatch=0;
for (const s of data) {
  const det = detectCountyFromLocatie(s.locatie);
  const flag = (det && s.county && det!==s.county) ? "⚠️MISMATCH" : "";
  if (flag) mismatch++;
  console.log(`${s.code} | ${s.lat.toFixed(3)},${s.lng.toFixed(3)} | ${s.county||'-'} | ${det||'-'} ${flag} | ${(s.locatie||'').slice(0,42)}`);
}
console.log(`\nMISMATCH-uri (det.locatie ≠ county): ${mismatch}`);
// coords duplicate (acelasi punct = posibil default/centroid)
const m={}; for(const s of data){const k=`${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;(m[k]=m[k]||[]).push(s.code);}
const dups=Object.entries(m).filter(([,v])=>v.length>1);
console.log(`\nCOORDS DUPLICATE (același punct, posibil default): ${dups.length}`);
for(const[k,v]of dups) console.log(`  ${k}: ${v.join(",")}`);
