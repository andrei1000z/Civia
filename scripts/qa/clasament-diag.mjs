import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, count } = await admin.from("sesizari")
  .select("code, county, locatie, status, author_name, author_display_name, publica, moderation_status", { count: "exact" })
  .eq("moderation_status","approved").eq("publica",true);
console.log(`Public approved: ${data?.length} (count=${count})`);
const resolved = (data||[]).filter(s=>s.status==="rezolvat");
console.log(`\n=== REZOLVATE: ${resolved.length} ===`);
for (const s of resolved) console.log(`  [${s.code}] county=${s.county} | ${s.locatie?.slice(0,45)} | autor: ${s.author_display_name||s.author_name||"(null)"}`);

// distributie county
const byCounty = {};
for (const s of data||[]) byCounty[s.county||"NULL"]=(byCounty[s.county||"NULL"]||0)+1;
console.log(`\n=== Pe county ===`, JSON.stringify(byCounty));

// rezolvate pe county
const resByCounty = {};
for (const s of resolved) resByCounty[s.county||"NULL"]=(resByCounty[s.county||"NULL"]||0)+1;
console.log(`Rezolvate pe county:`, JSON.stringify(resByCounty));

// autori - cati au rezolvate + cati sunt sub prag 2
const { leaderboardAuthorName } = await import("../../src/lib/sesizari/display-name.ts");
const byAuthor = {};
for (const s of data||[]) {
  const n = leaderboardAuthorName({ display_name: s.author_display_name, author_name: s.author_name });
  if (!byAuthor[n]) byAuthor[n]={total:0,rez:0};
  byAuthor[n].total++; if (s.status==="rezolvat") byAuthor[n].rez++;
}
console.log(`\n=== Autori cu rezolvate ===`);
for (const [n,v] of Object.entries(byAuthor).filter(([,v])=>v.rez>0)) console.log(`  ${n}: ${v.rez} rezolvate / ${v.total} total ${v.total<2?"⚠️SUB PRAG 2":""} ${n==="Cetățean"?"⚠️ANONIM":""}`);
