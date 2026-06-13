import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const UP = [
  ["00003", "actiune-autoritate", "2026-05-13", "PDF 38609: confirmat, Note Constatare + Admin Strazilor (era ignorat!)"],
  ["00006", "actiune-autoritate", "2026-05-29", "PDF 41332: confirmat, Note Constatare + reparatii trotuare planificate"],
  ["00037", "redirectionata",     "2026-06-10", "PDF 88351: Primaria S2 -> redirectionat la Admin Strazilor"],
  ["00008", null,                 "2026-05-13", "PDF 41751: confirmat (status rezolvat pastrat)"],
  ["00011", null,                 "2026-05-13", "PDF 42066: confirmat (status rezolvat pastrat)"],
];
for (const [code, status, respAt, note] of UP) {
  const patch = { official_response_at: new Date(respAt + "T10:00:00Z").toISOString() };
  if (status) patch.status = status;
  const { error } = await a.from("sesizari").update(patch).eq("code", code);
  console.log(`${code}: ${error ? "ERR "+error.message : "OK "+(status||"(status pastrat)")+" | resp "+respAt}`);
}
