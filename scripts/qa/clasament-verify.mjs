import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { extractLocality } = await import("../../src/lib/sesizari/extract-locality.ts");
const { ALL_COUNTIES } = await import("../../src/data/counties.ts");
const { leaderboardAuthorName } = await import("../../src/lib/sesizari/display-name.ts");
const { data } = await a.from("sesizari").select("county,status,locatie,author_name,author_display_name").eq("moderation_status","approved").eq("publica",true);

// national
let nt=0,nr=0; for(const r of data){nt++; if(r.status==="rezolvat")nr++;}
console.log(`RATA NAȚIONALĂ: ${nr}/${nt} = ${Math.round(nr/nt*100)}% (înainte: 4/63=6%)`);

// zone
const zoneOf=(loc,co)=>{const l=extractLocality(loc); if(co==="B")return l??"București (altă zonă)"; if(l&&!l.startsWith("Sector"))return l; const n=co?ALL_COUNTIES.find(c=>c.id===co)?.name:null; return n??l??null;};
const z=new Map(); for(const r of data){const k=zoneOf(r.locatie,r.county); if(!k)continue; const b=z.get(k)??{t:0,rez:0}; b.t++; if(r.status==="rezolvat")b.rez++; z.set(k,b);}
console.log(`\nZONE (prag>=2):`);
for(const [k,b] of [...z.entries()].filter(([,b])=>b.t>=2).sort((a,b)=>b.rez/b.t-a.rez/a.t||b.t-a.t)) console.log(`  ${k}: ${b.rez}/${b.t} (${Math.round(b.rez/b.t*100)}%)`);

// users
const u=new Map(); for(const r of data){const n=leaderboardAuthorName({display_name:r.author_display_name,author_name:r.author_name}); if(!n||n==="Cetățean")continue; const b=u.get(n)??{t:0,rez:0}; b.t++; if(r.status==="rezolvat")b.rez++; u.set(n,b);}
console.log(`\nCETĂȚENI (prag: 2+ SAU 1+ rezolvată):`);
for(const [n,b] of [...u.entries()].filter(([,b])=>b.t>=2||b.rez>=1).sort((a,b)=>b[1].rez-a[1].rez||b[1].t-a[1].t).slice(0,10)) console.log(`  ${n}: ${b.t} ses · ${b.rez} rez ${b.rez>0&&b.t<2?"← ACUM VIZIBIL (era ascuns)":""}`);
