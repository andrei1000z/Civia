import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const key = Buffer.from(process.env.FIELD_ENCRYPTION_KEY, "base64");
function dec(s){ if(!s||!s.startsWith("enc:v1:"))return s; const r=Buffer.from(s.slice(7),"base64"); const d=createDecipheriv("aes-256-gcm",key,r.subarray(0,12)); d.setAuthTag(r.subarray(12,28)); return Buffer.concat([d.update(r.subarray(28)),d.final()]).toString("utf8"); }
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("sesizari").select("code,author_address").not("author_address","is",null);
const enc = data.filter(s=>s.author_address.startsWith("enc:v1:"));
const plain = data.filter(s=>!s.author_address.startsWith("enc:v1:"));
console.log(`Total cu adresă: ${data.length} | CRIPTATE: ${enc.length} | text simplu rămas: ${plain.length}`);
console.log("\nVerificare round-trip (3 exemple — cifru → decriptat):");
for (const s of enc.slice(0,3)) console.log(`  ${s.code}: ${s.author_address.slice(0,28)}… → „${dec(s.author_address)}"`);
if (plain.length) console.log(`\nRămase text simplu: ${plain.map(s=>s.code).join(", ")}`);
