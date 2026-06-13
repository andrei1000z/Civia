import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count: total } = await a.from("stiri_cache").select("id",{count:"exact",head:true});
const { count: nullS } = await a.from("stiri_cache").select("id",{count:"exact",head:true}).is("ai_summary",null);
const { count: thin } = await a.from("stiri_cache").select("id",{count:"exact",head:true}).is("ai_summary",null);
console.log(`Stiri total: ${total} | fără ai_summary: ${nullS} (${Math.round(nullS/total*100)}%)`);
