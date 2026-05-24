import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const code = process.argv[2] ?? "00040";
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.from("sesizari").select("formal_text").eq("code", code).maybeSingle();
  if (!data?.formal_text) {
    console.log("not found / no formal_text");
    return;
  }
  console.log("=== formal_text ===");
  console.log(data.formal_text);
  console.log("=== END ===");
}
main();
