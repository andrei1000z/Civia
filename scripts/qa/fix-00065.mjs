import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const UA={"User-Agent":"CivicRomania/1.0 (civia.ro)"}; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function geo(q){await sleep(1200);const u=`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ro&limit=1&accept-language=ro`;try{const r=await fetch(u,{headers:UA});const arr=await r.json();const h=arr[0];return h?{lat:+h.lat,lng:+h.lon,name:h.display_name}:null}catch{return null}}
const r = await geo("Roșiorii de Vede, Teleorman, România");
console.log("Roșiorii de Vede →", r ? `${r.lat.toFixed(4)},${r.lng.toFixed(4)} | ${r.name.slice(0,60)}` : "NULL");
if (r && r.lat>43.5 && r.lat<48.3) {
  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await a.from("sesizari").update({ lat:r.lat, lng:r.lng, county:"TR" }).eq("code","00065");
  console.log(`00065: ${error ? "❌ "+error.message : "✅ Roșiorii de Vede (TR) "+r.lat.toFixed(4)+","+r.lng.toFixed(4)}`);
}
