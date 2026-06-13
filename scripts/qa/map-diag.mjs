import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari_feed").select("code,status,lat,lng,sector");
const total = data.length;
const withCoords = data.filter(s=>s.lat!=null && s.lng!=null);
const noCoords = data.filter(s=>s.lat==null || s.lng==null);
console.log(`Public feed: ${total} | CU lat/lng: ${withCoords.length} | FĂRĂ: ${noCoords.length} ← astea NU apar pe hartă`);
// status breakdown total vs pe hartă
const by = (arr)=>{const m={};for(const s of arr)m[s.status]=(m[s.status]||0)+1;return m;};
console.log("\nStatus TOTAL:", JSON.stringify(by(data)));
console.log("Status PE HARTĂ (cu coords):", JSON.stringify(by(withCoords)));
console.log("Status fără coords (ascunse):", JSON.stringify(by(noCoords)));
// exemple fără coords
console.log("\nExemple fără coords:", noCoords.slice(0,8).map(s=>`${s.code}(${s.status})`).join(", "));
