/**
 * Batch test: rulează pipeline-ul REAL de generare text formal (identic cu
 * /api/ai/improve) pe inputuri informale reale, scrise ca de un cetățean
 * obișnuit (argou, înjurături, fără diacritice, typos). Salvează output-urile
 * în civia-batch-out.json pentru analiză (workflow).
 *
 * Folosește fallback-ul Gemini (Groq e 429). Concurență limitată.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import {
  reformulateDescriere,
  reformulateAdresa,
  reorderActions,
  generateContextualActions,
} from "../src/lib/sesizari/reformulate-descriere";
import { generateFormalText, getPrefabActions } from "../src/lib/sesizari/formal-template";
import { detectsPoliceContext } from "../src/lib/sesizari/authorities";
import { writeFileSync } from "fs";

type Input = { id: number; descriere: string; tip: string; locatie: string; sector?: string };

const INPUTS: Input[] = [
  { id: 1, tip: "stalpisori", descriere: "sa monteze stalpisori in plm ca trec masinile pe acolo dracu era sa ma calce", locatie: "strada zorilor 5", sector: "S3" },
  { id: 2, tip: "groapa", descriere: "bah e o groapa cat casa pe strada mea de mi am rupt janta la masina astept de luni sa o repare nimic", locatie: "bd timisoara 80", sector: "S6" },
  { id: 3, tip: "iluminat", descriere: "nu mai merge niciun bec pe toata strada de vreo luna e bezna seara mi e frica sa ies", locatie: "aleea castanilor 3" },
  { id: 4, tip: "gunoi", descriere: "ma gunoiul nu se mai ridica de 2 saptamani s a facut munte langa tomberoane pute de nu mai poti", locatie: "str fizicienilor 12" },
  { id: 5, tip: "parcare", descriere: "frate parcheaza toti pe trotuar nu am loc cu caruciorul de copil trebuie sa ies in strada cu masinile", locatie: "calea mosilor 200", sector: "S2" },
  { id: 6, tip: "copac", descriere: "e un copac batran aplecat tare peste trotuar si la prima furtuna cade sigur pe cineva", locatie: "str plopilor 7" },
  { id: 7, tip: "semafor", descriere: "semaforu din intersectie clipeste galben de saptamani e haos total nimeni nu stie cine are prioritate", locatie: "intersectia stefan cel mare cu mihai bravu" },
  { id: 8, tip: "canalizare", descriere: "se infunda canalu cand ploua si se face lac de nu poti traversa strada apa intra si in subsol", locatie: "str dunarii 45" },
  { id: 9, tip: "trecere_pietoni", descriere: "nu e trecere de pietoni langa scoala si copiii traverseaza printre masini in goana groaznic", locatie: "bd pacii langa scoala 150" },
  { id: 10, tip: "graffiti", descriere: "tot blocul si statia sunt pline de mazgalituri urate desene obscene arata oribil", locatie: "piata sudului" },
  { id: 11, tip: "mobilier", descriere: "banca din parc e rupta de tot si cosul de gunoi smuls din beton", locatie: "parcul carol" },
  { id: 12, tip: "zgomot", descriere: "vecinii de la terasa pun muzica pana la 3 noaptea nu pot dormi de luni de zile", locatie: "str lipscani 20" },
  { id: 13, tip: "animale", descriere: "e o haita de maidanezi langa bloc care sar la oameni mai ales seara mi e frica de copii", locatie: "cartier rahova strada x" },
  { id: 14, tip: "transport", descriere: "autobuzu 105 vine din 2 in 2 ore si jumate cand vine e arhiplin nu mai incapi", locatie: "statia eroii revolutiei" },
  { id: 15, tip: "afisaj", descriere: "toti stalpii sunt plini de afise lipite ilegal si bannere atarnate arata mizerabil", locatie: "bd magheru" },
  { id: 16, tip: "banda_transport", descriere: "nu e banda dedicata pt autobuze pe bdul asta si stau blocate in trafic cu noi cu tot", locatie: "bd iuliu maniu" },
  { id: 17, tip: "rampa_acces", descriere: "nu e rampa la intrarea in dispensar si bunica mea in scaun cu rotile nu poate intra deloc", locatie: "str sanatatii 8" },
  { id: 18, tip: "colectare_selectiva", descriere: "nu avem unde sa reciclam in cartier nu e niciun container separat pt plastic sau hartie", locatie: "cartier drumul taberei" },
  { id: 19, tip: "fumat_interzis", descriere: "se fumeaza in statia de autobuz acoperita desi e interzis si copiii inhaleaza fum", locatie: "statia unirii" },
  { id: 20, tip: "altele", descriere: "lumea fumeaza pe scara blocului si intra fumu in apartamente nu mai suport", locatie: "str maramures 14" },
  { id: 21, tip: "pietonal", descriere: "trecerea de pietoni e cu marcaju sters complet nu se mai vede nimic masinile nu opresc", locatie: "bd carol 30" },
  { id: 22, tip: "trotuar", descriere: "trotuaru e tot spart denivelat plin de gropi era sa cad de doua ori si am piciorul scrantit", locatie: "str mendeleev 4" },
  { id: 23, tip: "altele", descriere: "e un cablu electric atarnat jos de tot peste trotuar de la un stalp cazut periculos rau", locatie: "str gheorghe lazar 2" },
  { id: 24, tip: "altele", descriere: "fantana arteziana din parc nu mai merge de un an statie goala plina de gunoaie", locatie: "parcul tineretului" },
  { id: 25, tip: "stalpisori", descriere: "vreau sa puneti bariere sa nu mai parcheze pe spatiul verde", locatie: "str primaverii 9", sector: "S1" },
  { id: 26, tip: "groapa", descriere: "groapa mare pe carosabil periculoasa", locatie: "dn1 km 12" },
  { id: 27, tip: "parcare", descriere: "ma calca pe nervi astia ca parcheaza pe trecerea de pietoni nu pot trece cu copilul", locatie: "str baba novac 23" },
  { id: 28, tip: "iluminat", descriere: "nu merge ilumintaul public pe strada e periculs noptea", locatie: "aleea teilor 6" },
  { id: 29, tip: "gunoi", descriere: "containerele de gunoi sunt arse cineva le a dat foc si miroase ingrozitor a plastic ars", locatie: "str salajan 11" },
  { id: 30, tip: "semafor", descriere: "ma semaforu e praf nu mai functioneaza becu rosu doar verde si galben super periculos", locatie: "intersectia titulescu cu banu manta" },
  { id: 31, tip: "canalizare", descriere: "lipseste un capac de canal pe mijlocul strazii o sa intre cineva cu masina sau sa cada un copil", locatie: "str vitan 55" },
  { id: 32, tip: "copac", descriere: "crengile copacului ajung in firele electrice si fac scantei cand bate vantul", locatie: "str polona 88" },
  { id: 33, tip: "trecere_pietoni", descriere: "as vrea o trecere de pietoni si un limitator de viteza ca masinile gonesc pe langa scoala", locatie: "bd basarabia 100" },
  { id: 34, tip: "animale", descriere: "sunt sobolani in jurul tomberoanelor de la bloc ies si ziua e dezgustator si periculos sanitar", locatie: "str ferentari 40" },
  { id: 35, tip: "transport", descriere: "statia de tramvai nu are acoperis nici banca stam in ploaie si frig cand asteptam", locatie: "statia romana" },
  { id: 36, tip: "altele", descriere: "faceti ceva va rog ca e mizerie peste tot in cartier gropi gunoi becuri arse de toate", locatie: "cartier berceni" },
  // ── stiluri diverse de scriere (cum scrie orice cetățean) ──
  { id: 37, tip: "groapa", descriere: "Subsemnatul vă aduc la cunoștință existența unei degradări majore a părții carosabile, care persistă de aproximativ trei luni și afectează siguranța circulației.", locatie: "Strada Aviatorilor nr. 10" },
  { id: 38, tip: "iluminat", descriere: "NU MAI MERGE ILUMINATUL DE O LUNA E PERICULOS NU SE VEDE NIMIC NOAPTEA FACETI CEVA", locatie: "str crizantemelor 4" },
  { id: 39, tip: "gunoi", descriere: "gunoi. necolectat. 2 saptamani. miros groaznic.", locatie: "str garii 9" },
  { id: 40, tip: "parcare", descriere: "de ce nu face nimeni nimic cu masinile parcate pe trotuar? cum sa trec cu copilul in carucior?", locatie: "bd unirii 15", sector: "S4" },
  { id: 41, tip: "canalizare", descriere: "deci va spun ca de fiecare data cand ploua mai tare se aduna apa pe strada noastra ca un lac intreg si nu se mai scurge ore in sir si lumea nu mai poate trece si masinile stropesc casele si intra apa si in curti si e o problema veche de ani pe care nimeni nu o rezolva", locatie: "str campului 22" },
  { id: 42, tip: "transport", descriere: "statia de bus e fara shelter, stam in rain mereu cand asteptam, please fix asap", locatie: "statia obor" },
  { id: 43, tip: "copac", descriere: "Bună ziua, aș dori să vă semnalez cu respect că există un copac uscat lângă trotuar care ar putea cădea la vânt puternic. Vă mulțumesc.", locatie: "str dorobantilor 33" },
  { id: 44, tip: "trecere_pietoni", descriere: "e o nebunie totala aici copiii nostri risca zilnic si nimeni nu pune o amarata de trecere de pietoni e revoltator chiar", locatie: "bd timisoara langa scoala 195" },
  { id: 45, tip: "trotuar", descriere: "Trotuarul este complet distrus, cu dale sparte și denivelări periculoase pe toată lungimea străzii.", locatie: "str maica domnului 7" },
  { id: 46, tip: "semafor", descriere: "SEMAFORUL nu merge!!! de saptamani!!! cine raspunde??? haos total la intersectie", locatie: "piata victoriei" },
  { id: 47, tip: "afisaj", descriere: "Vă semnalez prezența unor afișaje publicitare neautorizate lipite pe stâlpii de pe bulevard.", locatie: "bd dacia 50" },
  { id: 48, tip: "mobilier", descriere: "Bancă ruptă în parc, lângă locul de joacă.", locatie: "parcul herastrau" },
  { id: 49, tip: "altele", descriere: "Există o conductă spartă din care curge apă continuu pe stradă de câteva zile, se irosește apă.", locatie: "str apelor 3" },
  { id: 50, tip: "animale", descriere: "sunt multi caini fara stapan in zona se aduna in haite latra noaptea si sar la trecatori mi e teama sa ies cu copilul", locatie: "cartier pantelimon str x" },
];

async function generateOne(inp: Input) {
  const tipFinal = inp.tip ?? "altele";
  const prefab = getPrefabActions(tipFinal);
  const police = detectsPoliceContext(inp.descriere, inp.locatie);
  const needsContextual = tipFinal === "altele" || police.needsTraffic || police.needsLocal;
  const actionsPromise = needsContextual
    ? generateContextualActions({ descriere: inp.descriere, tip: tipFinal, locatie: inp.locatie, prefabFallback: prefab })
    : reorderActions({ tip: tipFinal, descriere: inp.descriere, prefabActions: prefab });
  const [desc, actions, locatieNorm] = await Promise.all([
    reformulateDescriere(inp.descriere, { tip: tipFinal }),
    actionsPromise,
    reformulateAdresa(inp.locatie),
  ]);
  let locatieFinal = locatieNorm ?? inp.locatie ?? "";
  if (inp.sector && /^S[1-6]$/.test(inp.sector) && !/sector/i.test(locatieFinal)) {
    locatieFinal = `${locatieFinal.replace(/[,\s]+$/, "")}, Sector ${inp.sector.slice(1)}, București`;
  }
  const formal = generateFormalText({
    tip: tipFinal,
    locatie: locatieFinal,
    descriere: desc,
    nume: "Eduard Andrei Mușat",
    adresa: "Strada Novaci 12, Sector 5, București",
    hasPhotos: true,
    customActions: actions,
  });
  return {
    id: inp.id,
    tip: tipFinal,
    descriere_originala: inp.descriere,
    locatie_originala: inp.locatie,
    descriere_reformulata: desc,
    locatie_finala: locatieFinal,
    formal_text: formal,
  };
}

async function main() {
  const results: unknown[] = [];
  const CONC = 3;
  for (let i = 0; i < INPUTS.length; i += CONC) {
    const batch = INPUTS.slice(i, i + CONC);
    const out = await Promise.all(
      batch.map((inp) =>
        generateOne(inp).catch((e) => ({ id: inp.id, tip: inp.tip, error: (e as Error).message, descriere_originala: inp.descriere })),
      ),
    );
    results.push(...out);
    console.log(`done ${Math.min(i + CONC, INPUTS.length)}/${INPUTS.length}`);
  }
  writeFileSync("scripts/civia-batch-out.json", JSON.stringify(results, null, 2));
  console.log("WROTE scripts/civia-batch-out.json");
}
main();
