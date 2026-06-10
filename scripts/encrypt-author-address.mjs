/**
 * Backfill: criptează la nivel de câmp adresele de domiciliu (author_address)
 * EXISTENTE în sesizari. Idempotent — sare peste cele deja criptate (prefix
 * enc:v1:). Format IDENTIC cu src/lib/crypto/field.ts (AES-256-GCM).
 *
 * RULEAZĂ DUPĂ ce ai setat FIELD_ENCRYPTION_KEY (aceeași valoare ca în Vercel)
 * în .env.local. Refuză să ruleze fără cheie (ca să nu „treacă" silent ca no-op).
 *
 *   node scripts/encrypt-author-address.mjs           # dry-run (doar raportează)
 *   node scripts/encrypt-author-address.mjs --apply   # aplică criptarea
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "node:crypto";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

const PREFIX = "enc:v1:";
const rawKey = process.env.FIELD_ENCRYPTION_KEY;
if (!rawKey) {
  console.error("❌ FIELD_ENCRYPTION_KEY lipsește din .env.local. Seteaz-o întâi (aceeași ca în Vercel).");
  process.exit(1);
}
const key = Buffer.from(rawKey, "base64");
if (key.length !== 32) {
  console.error(`❌ FIELD_ENCRYPTION_KEY trebuie să fie 32 bytes base64 (acum: ${key.length}).`);
  process.exit(1);
}

function encryptField(plain) {
  if (plain == null || plain === "" || plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

const APPLY = process.argv.includes("--apply");
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await a
  .from("sesizari")
  .select("id, code, author_address")
  .not("author_address", "is", null);
if (error) { console.error("❌", error.message); process.exit(1); }

const toEncrypt = (data ?? []).filter((s) => s.author_address && !s.author_address.startsWith(PREFIX));
console.log(`Sesizări cu adresă: ${data?.length ?? 0} | de criptat (text simplu): ${toEncrypt.length} | deja criptate: ${(data?.length ?? 0) - toEncrypt.length}`);

if (!APPLY) {
  console.log("\nDRY-RUN. Rulează cu --apply ca să criptezi.");
  process.exit(0);
}

let ok = 0, fail = 0;
for (const s of toEncrypt) {
  const enc = encryptField(s.author_address);
  const { error: upErr } = await a.from("sesizari").update({ author_address: enc }).eq("id", s.id);
  if (upErr) { console.error(`  ❌ ${s.code}: ${upErr.message}`); fail++; }
  else ok++;
}
console.log(`\n✅ Criptate: ${ok} | eșecuri: ${fail}`);
