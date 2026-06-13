import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// "Mașini" are ș. Search normalizează la "masini".
const { data: real } = await a.from("sesizari_feed").select("titlu").ilike("titlu","%Mașini%").limit(3);
console.log("sesizări cu 'Mașini' (real):", real?.length, real?.map(r=>r.titlu.slice(0,35)));
const { data: bug } = await a.from("sesizari_feed").select("titlu").ilike("titlu","%masini%").limit(3);
console.log("căutate cu 'masini' (cum face search-ul ACUM):", bug?.length, "← BUG dacă 0");
// fix imatch: m-a-s-i-n-i → m[aăâ][sșş]in[iî]  (construit din normalizat)
const { data: fix } = await a.from("sesizari_feed").select("titlu").or("titlu.imatch.m[aăâ][sșş]in[iî]").limit(3);
console.log("cu imatch diacritic-tolerant:", fix?.length, "← FIX", fix?.map(r=>r.titlu.slice(0,35)));
