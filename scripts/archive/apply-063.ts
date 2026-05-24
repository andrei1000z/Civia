import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const sqlPath = join(process.cwd(), "supabase", "migrations", "063_petitie_updates.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  console.log(`📄 Loaded migration 063 (${sql.length} chars)\n`);

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (res.ok) {
    console.log("✅", await res.json().catch(() => ({})));
    return;
  }
  console.log(`❌ ${res.status}`, (await res.text()).slice(0, 500));
  process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
