import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// replicate listRelatedPetitii: categorie=Mediu, county=B
for (const [cat, county] of [["Mediu","B"], ["Drepturi",null], ["Locuințe","CJ"]]) {
  const orFilter = county ? `county_code.eq.${county},county_code.is.null` : `county_code.is.null`;
  const { data, error } = await admin.from("petitii_with_count")
    .select("slug,title,category,county_code,signature_count,external_signature_count,target_signatures,status")
    .eq("category", cat).in("status",["active","closed"]).or(orFilter).limit(20);
  console.log(`\ncat=${cat} county=${county}: ${error ? "ERR "+error.message : (data?.length||0)+" petiții"}`);
  for (const p of (data||[])) console.log(`  - ${p.title.slice(0,50)} [${p.county_code||"național"}] sig=${p.external_signature_count ?? p.signature_count}`);
}
