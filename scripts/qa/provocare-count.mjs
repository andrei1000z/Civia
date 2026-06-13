import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count } = await a.from("sesizari").select("id",{count:"exact",head:true})
  .eq("moderation_status","approved").eq("publica",true).eq("tip","stalpisori").eq("county","B")
  .gte("created_at","2026-06-01T00:00:00.000Z").lt("created_at","2026-07-01T00:00:00.000Z");
console.log(`Provocare „stâlpișori în București, iunie 2026": ${count}/50 sesizări → ${Math.min(100,Math.round((count/50)*100))}% progres colectiv`);
