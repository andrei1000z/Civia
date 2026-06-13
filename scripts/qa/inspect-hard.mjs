import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,county,sector,locatie,descriere,tip").in("code",["00041","00065","00071"]);
for (const s of data) console.log(`[${s.code}] county=${s.county||'-'} sector=${s.sector||'-'} tip=${s.tip}\n  loc: ${s.locatie}\n  desc: ${(s.descriere||'').slice(0,140)}\n`);
// retry 00041 variants
const UA={"User-Agent":"CivicRomania/1.0 (civia.ro)"}; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function geo(q){await sleep(1200);const u=`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ro&limit=1&accept-language=ro`;try{const r=await fetch(u,{headers:UA});const arr=await r.json();const h=arr[0];return h?{lat:+h.lat,lng:+h.lon,name:h.display_name}:null}catch{return null}}
console.log("=== retry 00041 ===");
for (const q of ["Bulevardul Unirii, București, România","Piața Națiunile Unite, București","Bulevardul Națiunile Unite, București, România"]) {
  const r=await geo(q); console.log(`  "${q}" → ${r?`${r.lat.toFixed(4)},${r.lng.toFixed(4)} | ${r.name.slice(0,55)}`:'NULL'}`);
}
