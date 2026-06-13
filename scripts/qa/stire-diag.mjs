import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const id = "e78a34d0-7207-45b7-990f-a745e6294cfb";
const { data: s } = await admin.from("stiri_cache").select("id, title, excerpt, content, ai_summary, ai_summary_version, source, url").eq("id", id).maybeSingle();
if (!s) { console.log("negăsit"); process.exit(0); }
console.log("title:", s.title);
console.log("source:", s.source);
console.log("excerpt len:", (s.excerpt||"").length, "| preview:", (s.excerpt||"").slice(0,120));
console.log("content len:", (s.content||"").length);
console.log("ai_summary:", s.ai_summary ? `SET (len ${s.ai_summary.length}, v${s.ai_summary_version})` : "NULL ← de-asta 'se generează'");
console.log("url:", s.url);
// test extractiveSummary pe ce avem
const { extractiveSummary } = await import("../../src/lib/stiri/extractive-summary.ts");
const ext1 = extractiveSummary(s.title, s.content);
const ext2 = extractiveSummary(s.title, [s.excerpt, s.content].filter(Boolean).join("\n\n"));
console.log("\nextractiveSummary(title, content):", ext1 ? `OK (len ${ext1.length})` : "NULL ← fallback eșuează pe content subțire");
console.log("extractiveSummary(title, excerpt+content):", ext2 ? `OK (len ${ext2.length})` : "NULL");
// cate stiri au ai_summary null in total?
const { count: total } = await admin.from("stiri_cache").select("id",{count:"exact",head:true});
const { count: nullS } = await admin.from("stiri_cache").select("id",{count:"exact",head:true}).is("ai_summary",null);
console.log(`\nStiri total: ${total} | fără ai_summary: ${nullS} (${Math.round(nullS/total*100)}% blocate pe 'se generează')`);
