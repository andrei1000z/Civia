// One-off verify că migrarea 077 a creat coloana ai_input_text + index.
// Usage: npx tsx scripts/verify-migration-077.ts

import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function check(sql: string, label: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });
  const txt = await res.text();
  console.log(`\n${label}:`);
  console.log(`  status=${res.status}`);
  console.log(`  body=${txt.slice(0, 300)}`);
}

async function main() {
  await check(
    `select column_name, data_type from information_schema.columns
     where table_name='sesizare_replies' and column_name='ai_input_text';`,
    "1. Coloana ai_input_text",
  );

  await check(
    `select indexname from pg_indexes
     where tablename='sesizare_replies' and indexname='idx_sesizare_replies_ai_input_search';`,
    "2. Index full-text search",
  );

  await check(
    `select count(*) as total, count(ai_input_text) as with_input
     from sesizare_replies;`,
    "3. Backfill check (ai_input_text = body_text)",
  );
}

main();
