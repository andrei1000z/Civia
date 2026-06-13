import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,county,sector,locatie,lat,lng,status").not("lat","is",null);
// Limite România + București
const RO = {latMin:43.5,latMax:48.3,lngMin:20.2,lngMax:29.8};
const B  = {latMin:44.30,latMax:44.55,lngMin:25.92,lngMax:26.27};
let bad=[], outRO=[], bMismatch=[];
for (const s of data) {
  const inRO = s.lat>=RO.latMin&&s.lat<=RO.latMax&&s.lng>=RO.lngMin&&s.lng<=RO.lngMax;
  if (!inRO) { outRO.push(s); bad.push(s); continue; }
  if (s.county==="B") {
    const inB = s.lat>=B.latMin&&s.lat<=B.latMax&&s.lng>=B.lngMin&&s.lng<=B.lngMax;
    if (!inB) { bMismatch.push(s); bad.push(s); }
  }
}
console.log(`Total cu coords: ${data.length} | suspecte: ${bad.length}`);
console.log(`\n=== ÎN AFARA ROMÂNIEI (${outRO.length}) ===`);
for (const s of outRO) console.log(`  [${s.code}] ${s.lat.toFixed(4)},${s.lng.toFixed(4)} | ${s.county} | ${(s.locatie||'').slice(0,50)}`);
console.log(`\n=== BUCUREȘTI dar coords ÎN AFARA Bucureștiului (${bMismatch.length}) ===`);
for (const s of bMismatch) console.log(`  [${s.code}] ${s.lat.toFixed(4)},${s.lng.toFixed(4)} | ${(s.locatie||'').slice(0,55)}`);
