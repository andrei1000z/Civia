import { config } from "dotenv"; import { existsSync } from "fs"; import { createClient } from "@supabase/supabase-js";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: s } = await a.from("sesizari").select("code,publica,moderation_status,status").eq("code","00035").maybeSingle();
console.log("00035 sesizari:", JSON.stringify(s));
const { data: f } = await a.from("sesizari_feed").select("code,locatie").eq("code","00035").maybeSingle();
console.log("00035 în sesizari_feed (public):", f ? "DA - "+f.locatie : "NU (privată/neaprobată) → search nu o arată by design");
