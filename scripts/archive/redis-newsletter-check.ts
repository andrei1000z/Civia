import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
import { Redis } from "@upstash/redis";

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  console.log("URL set:", !!url, "TOKEN set:", !!token);
  if (!url || !token) return;
  const r = new Redis({ url, token });
  const len = await r.llen("civia:newsletter:subscribers");
  console.log("List length:", len);
  const items = await r.lrange("civia:newsletter:subscribers", 0, 99);
  console.log("Items returned:", items?.length);
  (items ?? []).slice(0, 5).forEach((x, i) => console.log(`  ${i+1}.`, typeof x === "string" ? x : JSON.stringify(x)));
}
main().catch(console.error);
