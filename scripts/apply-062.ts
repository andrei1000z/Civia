import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const sqlPath = join(process.cwd(), "supabase", "migrations", "062_quick_sign_petitions.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  console.log("📄 Loaded migration 062_quick_sign_petitions.sql");
  console.log(`   ${sql.length} chars\n`);

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  console.log(`▶ POST ${url}`);
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
    const j = await res.json().catch(() => ({}));
    console.log("✅ Migration aplicată:", j);
    return;
  }

  const errText = await res.text();
  console.log(`❌ exec_sql failed: ${res.status}`);
  console.log(errText.slice(0, 500));
  process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
