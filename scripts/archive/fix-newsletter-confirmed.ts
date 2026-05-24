/**
 * BUG FIX retroactiv: newsletter_subscribers care au confirmed_at setat
 * dar confirmed=false (din cauza bug-ului că handlerul update-a doar
 * confirmed_at, nu și confirmed). Le sincronizăm.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: rows } = await sa
    .from("newsletter_subscribers")
    .select("id, email, confirmed, confirmed_at, confirm_token");

  console.log(`📊 Total newsletter subscribers: ${rows?.length ?? 0}`);
  let fixed = 0;
  let stillUnconfirmed = 0;
  for (const r of (rows ?? []) as Array<{ id: string; email: string; confirmed: boolean; confirmed_at: string | null; confirm_token: string | null }>) {
    if (r.confirmed_at && !r.confirmed) {
      console.log(`  🔧 Sync ${r.email}: confirmed_at present dar confirmed=false → true`);
      await sa.from("newsletter_subscribers").update({ confirmed: true }).eq("id", r.id);
      fixed += 1;
    } else if (!r.confirmed && !r.confirmed_at) {
      console.log(`  ⏳ ${r.email}: încă neconfirmat (token=${r.confirm_token?.slice(0, 8) ?? "null"}...)`);
      stillUnconfirmed += 1;
    } else {
      console.log(`  ✓ ${r.email}: ok (confirmed=${r.confirmed})`);
    }
  }
  console.log(`\n📈 Fixed: ${fixed}, Still unconfirmed: ${stillUnconfirmed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
