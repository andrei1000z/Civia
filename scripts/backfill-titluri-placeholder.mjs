/**
 * Backfill: curăță titlurile placeholder din DB.
 *
 * Context (bug 2026-06-04): rândurile create înainte de fix aveau titlul
 * „Altele (categoria se creează automat din descriere)" (eticheta tip-picker-ului
 * se scurgea ca titlu). Read-guard-ul din repository.ts (`safeTitlu`) le afișează
 * deja curat la randare/email — DAR valoarea STOCATĂ rămâne placeholder. Acest
 * script o rescrie determinist (prima clauză din descriere), ca să fie curat și
 * în DB (admin tools, query-uri directe, export).
 *
 * SAFE: dry-run by default. Rulează cu `--apply` ca să scrie efectiv.
 *
 *   node scripts/backfill-titluri-placeholder.mjs            # dry-run (doar listează)
 *   node scripts/backfill-titluri-placeholder.mjs --apply    # scrie în DB
 *
 * Necesită în .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// --- mini .env.local loader (fără dependențe) ---
function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* env may already be set */ }
}
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const admin = createClient(URL_, KEY);

// --- detecție placeholder (oglindă a isPlaceholderTitlu din titlu.ts) ---
const TIP_LABELS = new Set(["altele", "sesizare civica"]);
const norm = (s) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function isPlaceholder(titlu) {
  const t = (titlu ?? "").trim();
  if (t.length < 5) return true;
  if (/categoria\s+se\s+cre/i.test(t)) return true;
  if (/\(categ/i.test(t)) return true;
  if (/^sesizare\s+civic/i.test(t)) return true;
  return TIP_LABELS.has(norm(t));
}
// --- derivare deterministă (oglindă a deriveTitluFromDescriere) ---
function deriveTitlu(descriere) {
  let s = (descriere ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "Sesizare civică";
  s = s.replace(/^(bun[ăa]\s+ziua|bun[ăa]\s+seara|salut(?:are)?|stimate?\s+\w+)[\s,.:;!-]*/i, "").trim();
  if (!s) return "Sesizare civică";
  const first = s.split(/(?<=[.!?])\s+/)[0] ?? s;
  let title = first.trim();
  if (title.length > 70) {
    const cut = title.slice(0, 70);
    const sp = cut.lastIndexOf(" ");
    title = (sp > 30 ? cut.slice(0, sp) : cut).trim();
  }
  title = title.replace(/[.,;:!?\s]+$/, "").trim();
  if (title.length < 3) return "Sesizare civică";
  return title.charAt(0).toUpperCase() + title.slice(1);
}

const { data, error } = await admin
  .from("sesizari")
  .select("id, code, titlu, descriere")
  .limit(5000);
if (error) { console.error("Query failed:", error.message); process.exit(1); }

const bad = (data ?? []).filter((r) => isPlaceholder(r.titlu));
console.log(`Scanate: ${data?.length ?? 0} · titluri placeholder: ${bad.length}`);
console.log(APPLY ? "MOD: APPLY (scriu în DB)\n" : "MOD: DRY-RUN (nimic nu se scrie; --apply ca să scrii)\n");

let updated = 0;
for (const r of bad) {
  const nou = deriveTitlu(r.descriere);
  console.log(`  ${r.code}: „${r.titlu}" → „${nou}"`);
  if (APPLY) {
    const { error: upErr } = await admin.from("sesizari").update({ titlu: nou }).eq("id", r.id);
    if (upErr) console.error(`    ⚠ update eșuat ${r.code}: ${upErr.message}`);
    else updated++;
  }
}
console.log(`\nGata. ${APPLY ? `Actualizate: ${updated}/${bad.length}` : `(dry-run — 0 scrise)`}`);
