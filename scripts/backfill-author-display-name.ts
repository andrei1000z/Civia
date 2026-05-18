/**
 * Backfill: populeaza author_display_name pe sesizari existente.
 *
 * Logica:
 *  - daca user_id e setat → ia profile.display_name (set la creare cont sau /cont)
 *  - daca nu → primul cuvant din author_name
 *
 * Usage:
 *   npx tsx scripts/backfill-author-display-name.ts dry-run
 *   npx tsx scripts/backfill-author-display-name.ts apply
 */

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mode = process.argv[2] === "apply" ? "apply" : "dry-run";

async function main() {
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  console.log(`▶ Backfill author_display_name — mode: ${mode}`);

  // 1. Toate sesizările.
  const { data: rows, error } = await admin
    .from("sesizari")
    .select("id, code, user_id, author_name, author_display_name");
  if (error) {
    console.error("fetch failed:", error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("nicio sesizare");
    return;
  }

  // 2. Pull all profiles cu display_name pentru user_ids din sesizari.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));
  const profileDisplayMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileDisplayMap.set(p.id, p.display_name?.trim() || null);
    }
  }

  let toUpdate = 0;
  let updated = 0;
  for (const r of rows) {
    let display: string | null = null;
    if (r.user_id) {
      display = profileDisplayMap.get(r.user_id) ?? null;
    }
    if (!display && r.author_name) {
      const firstWord = r.author_name.trim().split(/\s+/)[0]?.trim();
      display = firstWord || null;
    }
    if (!display) continue;
    if (r.author_display_name === display) continue;

    toUpdate += 1;
    if (mode === "apply") {
      const { error: upErr } = await admin
        .from("sesizari")
        .update({ author_display_name: display })
        .eq("id", r.id);
      if (upErr) console.error(`✗ ${r.code}: ${upErr.message}`);
      else updated += 1;
    } else {
      console.log(`[${r.code}] „${r.author_name}" → „${display}"`);
    }
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`Scanate: ${rows.length}`);
  console.log(`Necesita backfill: ${toUpdate}`);
  if (mode === "apply") {
    console.log(`Updated: ${updated}`);
  } else {
    console.log(`(dry-run — pentru apply: npx tsx scripts/backfill-author-display-name.ts apply)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
