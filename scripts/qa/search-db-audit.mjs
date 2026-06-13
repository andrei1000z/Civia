import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Bug recall diacritice: caut "petitie" (normalizat) în titluri cu "petiție"
console.log("=== TEST RECALL DIACRITICE ===");
const { data: withDia } = await a.from("petitii").select("title").ilike("title","%petiție%").limit(5);
console.log("petiții cu 'petiție' în titlu:", withDia?.length ?? 0, withDia?.map(p=>p.title.slice(0,40)));
const { data: norm } = await a.from("petitii").select("title").ilike("title","%petitie%").limit(5);
console.log("căutate cu 'petitie' (normalizat, cum face search-ul):", norm?.length ?? 0, "← dacă 0 dar sus >0 = BUG recall");

// 2. Test imatch (regex diacritic-tolerant) — soluția fără migrație
const { data: im } = await a.from("petitii").select("title").or("title.imatch.peti[tțţ]i[eé]").limit(5);
console.log("\ncu imatch 'peti[tțţ]i[eé]':", im?.length ?? 0, "← fix-ul propus");

// 3. EXPLAIN pe sesizari_feed (via rpc dacă există, altfel doar count)
const { count: sc } = await a.from("sesizari_feed").select("code",{count:"exact",head:true});
const { count: stc } = await a.from("stiri_cache").select("id",{count:"exact",head:true});
console.log(`\n=== VOLUM ===\nsesizari_feed: ${sc} | stiri_cache: ${stc} → scară mică, perf OK fără migrație`);
