import { detectCountyFromLocatie } from "../../src/lib/sesizari/county-from-locatie.ts";
import { getAuthoritiesFor } from "../../src/lib/sesizari/authorities.ts";

const cases = [
  { loc: "Strada Unirii 12, Craiova", tip: "groapa" },
  { loc: "Calea București, Craiova, Dolj", tip: "trotuar" },
  { loc: "Bulevardul Eroilor, Cluj-Napoca", tip: "iluminat" },
  { loc: "Strada Ștefan cel Mare, Iași", tip: "parcare" },
  { loc: "Piața Victoriei, Timișoara", tip: "gunoi" },
];

for (const c of cases) {
  const county = detectCountyFromLocatie(c.loc);
  const r = getAuthoritiesFor(c.tip, null, county, c.loc);
  const primary = (r.primary ?? []).map(a => `${a.name} <${a.email}>`);
  const cc = (r.cc ?? []).map(a => a.name);
  console.log(`\n📍 ${c.loc} (${c.tip})`);
  console.log(`   județ detectat: ${county}`);
  console.log(`   → TO: ${primary.join(" | ")}`);
  console.log(`   → CC: ${cc.join(" | ")}`);
}
