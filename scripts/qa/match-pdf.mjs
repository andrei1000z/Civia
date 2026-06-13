import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,locatie,sector,status,tip,official_response_at").order("code");
for (const s of data) console.log(`${s.code} | ${s.status.padEnd(18)} | ${s.sector||'--'} | ${s.tip.padEnd(12)} | ${(s.locatie||'').slice(0,52)}`);
