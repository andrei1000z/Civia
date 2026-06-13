/** Test B (descriere lungă reformulată, nu boilerplate) + C (acțiuni ne-trunchiate). */
import { config } from "dotenv";
config({ path: ".env.local" });
import { reformulateDescriere, generateContextualActions } from "../src/lib/sesizari/reformulate-descriere";
import { getPrefabActions } from "../src/lib/sesizari/formal-template";

const USER_DESC =
  "solicit instalarea de stâlpișori antiparcare. Solicitarea mea este necesară deoarece numeroase autoturisme sunt parcate neregulamentar pe trotuar și circulă printre pietoni, punând în pericol siguranța acestora. De asemenea, în apropiere există o parcare cu plată care este frecvent neocupată, însă șoferii aleg să utilizeze trotuarele pentru parcare.";

async function main() {
  console.log("=== B: descriere LUNGĂ cu detaliu (trebuie reformulată, NU boilerplate) ===");
  const r1 = await reformulateDescriere(USER_DESC, { tip: "stalpisori" });
  const keptDetail = /parcare cu plat|neocupat|pieton|trotuar/i.test(r1);
  console.log(`  ${keptDetail ? "✓ păstrează detaliul" : "✗ a pierdut detaliul"}\n  → "${r1}"`);

  console.log("\n=== B: cerere SCURTĂ pură (OK să folosească boilerplate) ===");
  const r2 = await reformulateDescriere("solicit instalarea de stâlpișori antiparcare", { tip: "stalpisori" });
  console.log(`  → "${r2}"`);

  console.log("\n=== C: acțiuni contextuale (nu trebuie tăiate la final) ===");
  const acts = await generateContextualActions({
    descriere: USER_DESC,
    tip: "stalpisori",
    locatie: "Strada Știrbei Vodă, între Strada Berzei și Calea Plevnei",
    prefabFallback: getPrefabActions("stalpisori"),
  });
  for (const a of acts) {
    const complete = /[.!?)]$/.test(a.trim());
    console.log(`  ${complete ? "✓" : "✗ TĂIAT"} ${a}`);
  }
}
main();
