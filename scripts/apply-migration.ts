// Generic apply-one-migration helper. Pass the migration filename as
// argv[2]. Reads .env.local, hits the exec_sql RPC, prints status.
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx scripts/apply-migration.ts <migration-filename.sql>");
  process.exit(1);
}

const sql = readFileSync(join("supabase", "migrations", file), "utf-8");

async function main() {
  const r = await fetch(url + "/rest/v1/rpc/exec_sql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key!,
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({ sql }),
  });
  const text = await r.text();
  console.log(`▶ ${file}`);
  console.log(`   status: ${r.status}`);
  console.log(`   body: ${text.slice(0, 1000)}`);
  if (!r.ok) process.exit(1);
}
main();
