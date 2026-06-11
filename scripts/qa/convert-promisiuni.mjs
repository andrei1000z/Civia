/**
 * Convertor: output-ul workflow-ului de research → src/data/promisiuni-bulk.json
 * (intrările bulk ale Promisometrului, generate PROGRAMATIC — fără capcanele de
 * ghilimele românești din TS scris de mână).
 *
 * Normalizează + VALIDEAZĂ fiecare intrare (county, date ISO, status, sursă
 * https, notă ≥20 caractere); ce nu trece e raportat și ARUNCAT (calitatea bate
 * volumul). Dedup pe id + pe (autoritate|prefix-promisiune) contra intrărilor
 * curate din promisiuni.ts și a bulk-ului existent. MERGE (nu suprascrie).
 *
 *   node scripts/qa/convert-promisiuni.mjs <output-file.json> [--apply]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";

const VALID_COUNTIES = new Set(["AB","AR","AG","BC","BH","BN","BT","BV","BR","BZ","CS","CL","CJ","CT","CV","DB","DJ","GL","GR","GJ","HR","HD","IL","IS","IF","MM","MH","MS","NT","OT","PH","SM","SJ","SB","SV","TR","TM","TL","VS","VL","VN","B","RO"]);
const VALID_STATUS = new Set(["respectata","in-curs","intarziata","incalcata"]);
const BULK_PATH = "src/data/promisiuni-bulk.json";

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const semKey = (p) => (p.autoritate + "|" + p.promisiune.slice(0,40)).toLowerCase();

function normCounty(c) {
  if (!c) return null;
  const up = String(c).trim().toUpperCase();
  if (VALID_COUNTIES.has(up)) return up;
  if (/BUCUR|SECTOR/i.test(c)) return "B";
  if (/^RO/i.test(up) || /NATIONAL|NAȚIONAL/i.test(c)) return "RO";
  return null;
}
function normDate(d) {
  if (!d || d === "null") return null;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return null;
}

const inputPath = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!inputPath) { console.error("Folosire: node convert-promisiuni.mjs <output.json> [--apply]"); process.exit(1); }

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const items = raw?.result?.solide ?? raw?.solide ?? [];
console.log(`Intrări în input: ${items.length}`);

// Cheile semantice + id-urile existente (curate TS + bulk JSON anterior).
const curatedTs = readFileSync("src/data/promisiuni.ts", "utf8");
const existingIds = new Set([...curatedTs.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map(m => m[1]));
const existingKeys = new Set();
for (const m of curatedTs.matchAll(/autoritate:\s*"([^"]+)"[\s\S]{0,400}?promisiune:\s*\n?\s*"([^"]+)"/g)) {
  existingKeys.add((m[1] + "|" + m[2].slice(0,40)).toLowerCase());
}
let bulk = existsSync(BULK_PATH) ? JSON.parse(readFileSync(BULK_PATH, "utf8")) : [];
for (const b of bulk) { existingIds.add(b.id); existingKeys.add(semKey(b)); }

const ACUZATOR = [/minci/i, /minți/i, /corup/i, /escroc/i, /hoț/i, /fură/i];
const out = [];
const dropped = [];
for (const p of items) {
  const county = normCounty(p.county);
  const dataSursa = normDate(p.dataSursa);
  const termenIso = normDate(p.termenIso);
  const status = VALID_STATUS.has(p.status) ? p.status : null;
  const problems = [];
  if (!county) problems.push(`county "${p.county}"`);
  if (!dataSursa) problems.push(`dataSursa "${p.dataSursa}"`);
  if (!status) problems.push(`status "${p.status}"`);
  if (!/^https:\/\//.test(p.sursaUrl ?? "")) problems.push("sursaUrl");
  if (!p.nota || p.nota.length < 20) problems.push("nota scurtă");
  if (ACUZATOR.some(re => re.test(p.nota ?? ""))) problems.push("limbaj acuzator în notă");
  if (existingKeys.has(semKey(p))) problems.push("duplicat semantic");
  if (problems.length) { dropped.push({ autoritate: p.autoritate, promisiune: p.promisiune.slice(0,50), problems }); continue; }

  let id = `${slug(p.autoritate).split("-").slice(0,3).join("-")}-${slug(p.promisiune).split("-").slice(0,4).join("-")}`.slice(0, 64);
  let n = 2;
  while (existingIds.has(id)) id = `${id}-${n++}`;
  existingIds.add(id);
  existingKeys.add(semKey(p));

  out.push({
    id,
    autoritate: String(p.autoritate).trim(),
    functie: String(p.functie ?? "").trim() || "—",
    county,
    promisiune: String(p.promisiune).trim(),
    termen: String(p.termen ?? "nedeclarat").trim().slice(0, 120),
    termenIso,
    sursaUrl: String(p.sursaUrl).trim(),
    publicatie: String(p.publicatie ?? "sursă").trim().slice(0, 60),
    dataSursa,
    status,
    nota: String(p.nota).trim(),
    verificatLa: "2026-06-11",
  });
}

console.log(`✅ Valide: ${out.length} | ❌ aruncate: ${dropped.length}`);
for (const d of dropped) console.log(`  ✗ ${d.autoritate}: ${d.promisiune}… [${d.problems.join(", ")}]`);
if (APPLY) {
  bulk = [...bulk, ...out];
  writeFileSync(BULK_PATH, JSON.stringify(bulk, null, 1) + "\n");
  console.log(`\n💾 ${BULK_PATH}: ${bulk.length} intrări bulk total`);
} else {
  console.log("\nDRY-RUN (adaugă --apply).");
}
