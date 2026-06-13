import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FIX = [
  { code:"00032", patch:{ lat:44.4385, lng:26.1651 } },
  { code:"00033", patch:{ lat:44.4273, lng:26.0917 } },
  { code:"00041", patch:{ lat:44.4302, lng:26.0898 } },
  { code:"00071", patch:{ lat:44.4378, lng:26.0973, county:"B" } },
  { code:"00065", patch:{ lat:null, lng:null } },
];
for (const f of FIX) {
  const { error } = await a.from("sesizari").update(f.patch).eq("code", f.code);
  console.log(`${f.code}: ${error ? "❌ "+error.message : "✅ "+JSON.stringify(f.patch)}`);
}
