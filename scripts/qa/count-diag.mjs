import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { count: total } = await a.from("sesizari").select("id",{count:"exact",head:true});
const { count: pubApproved } = await a.from("sesizari").select("id",{count:"exact",head:true}).eq("publica",true).eq("moderation_status","approved");
const { count: sent } = await a.from("sesizari").select("id",{count:"exact",head:true}).not("sent_at","is",null);
const { count: rezolvat } = await a.from("sesizari").select("id",{count:"exact",head:true}).eq("status","rezolvat");
const { data: maxCode } = await a.from("sesizari").select("code").order("code",{ascending:false}).limit(1).maybeSingle();
// feed view (ce afișează sesizari-publice)
const { count: feedCount } = await a.from("sesizari_feed").select("code",{count:"exact",head:true});
console.log(`MAX cod: ${maxCode?.code}`);
console.log(`total sesizari (toate): ${total}`);
console.log(`public + approved: ${pubApproved}  ← „N sesizari pe Civia" (sesizari-publice header)`);
console.log(`sesizari_feed (view): ${feedCount}`);
console.log(`trimise (sent_at not null): ${sent}  ← „N sesizari trimise" (homepage hero)`);
console.log(`rezolvate: ${rezolvat}`);
// care din public approved NU sunt în feed sau invers?
const { data: pub } = await a.from("sesizari").select("code").eq("publica",true).eq("moderation_status","approved");
const { data: feed } = await a.from("sesizari_feed").select("code");
const pubSet = new Set((pub??[]).map(r=>r.code)), feedSet = new Set((feed??[]).map(r=>r.code));
const inPubNotFeed = [...pubSet].filter(c=>!feedSet.has(c));
const inFeedNotPub = [...feedSet].filter(c=>!pubSet.has(c));
console.log(`\npublic-approved dar NU în feed: ${JSON.stringify(inPubNotFeed)}`);
console.log(`în feed dar NU public-approved: ${JSON.stringify(inFeedNotPub)}`);
