/**
 * Wave 1 — Forțează theme="dark" pe toate profilurile (eliminate „system"/„light").
 *
 * User decision (2026-05-24): „dark singura optinue asa default si nu se
 * poate modifica gen doar dark e".
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
  const { data: profiles } = await sa
    .from("profiles")
    .select("id, display_name, theme")
    .neq("theme", "dark");

  console.log(`📊 Profile cu theme ≠ dark: ${profiles?.length ?? 0}`);
  for (const p of (profiles ?? []) as Array<{ id: string; display_name: string; theme: string }>) {
    console.log(`  - ${p.display_name}: ${p.theme} → dark`);
    await sa.from("profiles").update({ theme: "dark" }).eq("id", p.id);
  }
  console.log(`✨ Done. Toate profilurile au theme=dark.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
