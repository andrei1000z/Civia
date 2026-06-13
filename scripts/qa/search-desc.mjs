import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,locatie,descriere,sector,status,tip");
const KW = ["Cotroceni","Iatropol","Elefterie","Prezan","Mareșal","Banu Manta","Pantelimon nr","Sfânta Vineri","Coposu","Dinicu Golescu","Hasdeu","Hașdeu","13 Septembrie","Colentina"];
for (const kw of KW) {
  const hits = data.filter(s => (`${s.locatie} ${s.descriere}`||'').toLowerCase().includes(kw.toLowerCase()));
  console.log(`\n🔎 "${kw}" → ${hits.map(h=>`${h.code}(${h.status},${h.sector||'-'})`).join(", ") || "NIMIC"}`);
}
