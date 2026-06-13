import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await admin.from("petitii").select("category, county_code, status").limit(200);
const cats = {}, counties = {}, statuses = {};
for (const r of data ?? []) {
  cats[r.category ?? "NULL"] = (cats[r.category ?? "NULL"]||0)+1;
  counties[r.county_code ?? "NULL"] = (counties[r.county_code ?? "NULL"]||0)+1;
  statuses[r.status ?? "NULL"] = (statuses[r.status ?? "NULL"]||0)+1;
}
console.log("total petitii:", data?.length);
console.log("category dist:", JSON.stringify(cats));
console.log("county_code dist:", JSON.stringify(counties));
console.log("status dist:", JSON.stringify(statuses));
