/* Tokenize raw Tailwind shadow utilities → Civia design tokens (dark-mode tuned).
 * Mapping (by visual parity): sm→1, md→2, lg→3, xl→4, 2xl→5.
 * Preserves modifier prefixes (hover:, dark:, sm:, group-hover:, …) because we
 * only replace the `shadow-X` token itself. Skips:
 *   - already-tokenized `shadow-[var(--shadow-N)]`
 *   - `drop-shadow-*` (negative lookbehind for `drop-`)
 *   - color shadows `shadow-emerald-500/20` (those end in a color, not sm/md/lg/xl/2xl)
 *   - `shadow-none`, `shadow-inner` (not in the size set)
 * DRY-RUN by default; pass --apply to write.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");

// 2xl FIRST so `shadow-2xl` isn't partially eaten by the `shadow-...` rules.
// (?<![-\w]) skips any `shadow-X` preceded by a dash → excludes legacy token
// refs `--shadow-xl` AND `drop-shadow-X`. (?![\w-]) guards the trailing edge.
const RULES = [
  [/(?<![-\w])shadow-2xl(?![\w-])/g, "shadow-[var(--shadow-5)]"],
  [/(?<![-\w])shadow-xl(?![\w-])/g, "shadow-[var(--shadow-4)]"],
  [/(?<![-\w])shadow-lg(?![\w-])/g, "shadow-[var(--shadow-3)]"],
  [/(?<![-\w])shadow-md(?![\w-])/g, "shadow-[var(--shadow-2)]"],
  [/(?<![-\w])shadow-sm(?![\w-])/g, "shadow-[var(--shadow-1)]"],
];

const files = execSync('git ls-files "src/**/*.tsx" "src/**/*.ts"', { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

let totalHits = 0;
const touched = [];
for (const f of files) {
  let src = readFileSync(f, "utf8");
  const before = src;
  let hits = 0;
  for (const [re, to] of RULES) {
    src = src.replace(re, () => { hits++; return to; });
  }
  if (hits > 0 && src !== before) {
    totalHits += hits;
    touched.push([f, hits]);
    if (APPLY) writeFileSync(f, src);
  }
}

touched.sort((a, b) => b[1] - a[1]);
for (const [f, n] of touched) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log(`\n${APPLY ? "APLICAT" : "DRY-RUN"}: ${totalHits} înlocuiri în ${touched.length} fișiere`);
