import type { Metadata } from "next";
import { GhidLayout, Chapter, Callout } from "@/components/ghiduri/GhidLayout";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

// 2026-05-24 Faza 9 (persona Cristina, mama 2 copii Pipera) — ghid civic
// dedicat parintilor. Tone: tu-form prietenos, "pentru siguranta copilului",
// nu activist civic. Acopera: drum spre scoala, treceri pietonale,
// iluminat parc, parcare ilegala langa scoala.

const FAQ_PARINTI = [
  {
    question: `Cum raportez o trecere de pietoni periculoasa langa scoala copilului?`,
    answer: `Fa o poza cu marcajul sters / lipsa indicatorului / lipsa semaforului. Adauga ora cand treci cu copilul (ex: 7:45 dimineata cand masinile abunda) si scoala/gradinita in descriere. Sesizarea ajunge automat la primaria locala + Politia Locala. Contextul scolar urgenteaza evaluarea (siguranta minorilor).`,
  },
  {
    question: `Pot raporta o groapa pe drumul de la gradinita?`,
    answer: `Da. Foloseste categoria „Groapa in asfalt" + descriere „pe ruta zilnica spre gradinita X, copilul meu trece de 2 ori pe zi pe acolo". Personalizarea cu detaliul scolii/gradinitei urgenteaza evaluarea interna a primariei.`,
  },
  {
    question: `Ce drepturi am ca parinte fata de scoala publica?`,
    answer: `Legea educatiei 1/2011 + Statutul elevului (OMEN 4742/2016) iti dau drept la: petitie pentru orice problema (igiena, siguranta, profesori), participare la Comitetul de Parinti (alegeri anuale), acces la dosarul scolar al copilului, transparenta buget scoala via Legea 544/2001.`,
  },
  {
    question: `Cum reclam o problema DOAR la scoala (fara implicare primarie)?`,
    answer: `1) Sesizare scrisa la directiunea scolii cu cerere de inregistrare oficiala (cere numarul de inregistrare). 2) Daca in 30 zile nu primesti raspuns: Inspectoratul Scolar Judetean. 3) In ultima instanta: Avocatul Poporului. Civia poate fi folosita pentru sesizari legate de INFRASTRUCTURA scolii (zid degradat, iluminat curte, etc.) care intra in responsabilitatea primariei.`,
  },
  {
    question: `Parcare ilegala in fata scolii — ce fac?`,
    answer: `Cazul cel mai frecvent reclamat de parinti. Fa-i poza (cu placuta vizibila) la ore de varf (7:30-8:30 dimineata sau 14:00-16:00 dupa-amiaza). Foloseste categoria „Parcare ilegala" + descriere „blocheaza vizibilitatea trecerii de pietoni de la scoala X, risc pentru copii". Politia Locala primeste emailul automat si are competenta directa pe contraventii (art. 142 OUG 195/2002). Termen legal raspuns: 30 zile.`,
  },
  {
    question: `Iluminatul lipseste in parcul unde merg cu copilul seara — la cine reclam?`,
    answer: `Primaria locala (Directia Spatii Verzi sau Iluminat Public). In Bucuresti: depinde de sector. Civia detecteaza automat sectorul din locatie si trimite emailul catre primaria competenta. Adauga o poza la apus + descriere despre nesiguranta dupa lasarea intunericului.`,
  },
  {
    question: `Pot implica copilul in sesizare civica (pentru educatie)?`,
    answer: `Da, e fantastic. Lasa-l sa faca poza (cu telefonul tau), discutati impreuna descrierea, arata-i emailul cand il trimiti. La raspuns oficial, cititi impreuna. E un ritual civic mic cu impact mare — copilul invata ca societatea civila functioneaza. Pe sesizare publica numele apare anonim ca [nume], nu va fi expus copilul.`,
  },
];

export const metadata: Metadata = {
  title: "Ghid pentru parinti — siguranta copilului in oras",
  description:
    "Cum reclami probleme civice ca parinte: trecere pietoni la scoala, parcare ilegala, iluminat parc, drepturi fata de scoala. Tone prietenos, exemple concrete.",
  alternates: { canonical: "/ghiduri/ghid-parinti" },
  openGraph: {
    title: "Ghid pentru parinti — Civia",
    description:
      "Cum aplici drepturile civice pentru siguranta copilului. Treceri de pietoni, scoala, parcuri, parcare.",
  },
};

const chapters = [
  { id: "drum-scoala", title: "Drumul spre scoala" },
  { id: "interior-scoala", title: "Probleme in scoala" },
  { id: "parcuri-spatii", title: "Parcuri si spatii publice" },
  { id: "drepturi", title: "Drepturile tale ca parinte" },
  { id: "implica-copilul", title: "Implica-ti copilul" },
];

export default function GhidParintiPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Acasa", url: SITE_URL },
          { name: "Ghiduri", url: `${SITE_URL}/ghiduri` },
          { name: "Ghid pentru parinti", url: `${SITE_URL}/ghiduri/ghid-parinti` },
        ]}
      />
      <FaqJsonLd items={FAQ_PARINTI} />

      <GhidLayout
        title="Ghid pentru parinti"
        subtitle="Cum reclami probleme civice cand ai un copil. Concret, prietenos, fara jargon."
        chapters={chapters}
        icon="👨‍👧"
        gradient="from-pink-500 to-rose-600"
        stats={[
          { label: "Timp citire", value: "22 min" },
          { label: "Capitole", value: "5" },
        ]}
      >
        <Chapter number={1} id="drum-scoala" title="Drumul spre scoala">
          <p>
            Cel mai sensibil interval al zilei: cand iti duci copilul la scoala sau gradinita. Probleme tipice — si solutii
            care functioneaza:
          </p>

          <h3>Trecere de pietoni periculoasa</h3>
          <p>
            Marcajele sterse, lipsa indicatorului, fara semafor, masini care nu opresc. Fa o poza la ora de varf (7:30-8:30
            sau 14:00-16:00). Adauga ora si scoala/gradinita in descriere — primaria prioritizeaza cazurile cu context
            scolar.
          </p>

          <Callout type="info" title="De ce contextul scolar urgenteaza">
            Primariile (si Politia Locala) au obligatie suplimentara pe siguranta minorilor — Legea 1/2011 art. 16 obligă autoritatile sa asigure rutele de acces sigure la unitatile de invatamant. Mentioneaza scoala in descriere pentru prioritizare.
          </Callout>

          <h3>Groapa pe drumul zilnic</h3>
          <p>
            Foloseste categoria „Groapa in asfalt". Personalizeaza: „pe ruta zilnica spre Gradinita 41, copilul meu trece
            de 2 ori pe zi". Primaria are buget separat pentru rute scolare — semnaleaza asta.
          </p>

          <h3>Parcare ilegala in fata scolii</h3>
          <p>
            Cazul cel mai des reclamat de parinti. Fa poza cu placuta vizibila (legal pe spatiu public). Categorie:
            „Parcare ilegala". Sesizarea ajunge automat la Politia Locala (competenta legala pe contraventii rutiere
            urbane, art. 142 OUG 195/2002). Termenul legal de raspuns: 30 zile (OG 27/2002).
          </p>

          <Callout type="warning" title="Atentie privacy">
            NU include fotografie cu fata copilului tau in sesizarea publica. Focusul e pe problema, nu pe el. Daca apare
            accidental, Civia anonimizeaza fetele automat inainte de publicare.
          </Callout>
        </Chapter>

        <Chapter number={2} id="interior-scoala" title="Probleme in scoala">
          <p>
            Civia se ocupa de problemele EXTERIORULUI scolii (infrastructura, drum, parcare). Pentru probleme INTERIOARE
            (profesori, mancare, igiena), traseul e diferit:
          </p>

          <ol>
            <li>Sesizare scrisa catre directiunea scolii. Cere numarul de inregistrare.</li>
            <li>
              Daca in 30 zile nu primesti raspuns sau e nesatisfacator:{" "}
              <strong>Inspectoratul Scolar Judetean</strong>.
            </li>
            <li>
              Ultim resort: <strong>Avocatul Poporului</strong>, departamentul „Drepturile copilului". Gratuit.
            </li>
          </ol>

          <h3>Infrastructura scolara (Civia poate ajuta)</h3>
          <p>
            Zid degradat, curtea fara iluminat, parc scolar abandonat, sala de sport nesigura. Acestea sunt in
            responsabilitatea <strong>primariei locale</strong> (proprietar al cladirii), nu a Inspectoratului. Le poti
            sesiza direct prin Civia.
          </p>
        </Chapter>

        <Chapter number={3} id="parcuri-spatii" title="Parcuri si spatii publice">
          <p>
            Toamna intunericul vine la 18:00 — copilul tau nu mai poate sa se joace in parcul de cartier. Iluminatul lipsa
            sau defect e responsabilitatea primariei (Directia Spatii Verzi sau Iluminat Public).
          </p>

          <h3>Echipamente de joaca deteriorate</h3>
          <p>
            Tobogan rupt, leagan cu cabluri, balansoar fara suruburi. Cazuri de siguranta urgenta — primaria are
            obligatia sa inchida temporar zona pana la reparatie (Legea 60/2012, art. 9).
          </p>

          <h3>Gunoaie + igiena</h3>
          <p>
            Cosuri lipsa, container rupt, recipiente neevacuate. Categorie: „Gunoi/Salubritate". Sesizarea ajunge la
            firma de salubritate contractata de primarie + Garda de Mediu pentru cazuri grave.
          </p>
        </Chapter>

        <Chapter number={4} id="drepturi" title="Drepturile tale ca parinte">
          <p>Cadrul legal pe scurt:</p>

          <ul>
            <li>
              <strong>Constitutia, art. 51</strong> — dreptul de petitionare. Orice persoana poate adresa petitii
              autoritatilor publice.
            </li>
            <li>
              <strong>OG 27/2002</strong> — autoritatea trebuie sa raspunda in 30 zile. Daca nu, poti escalada.
            </li>
            <li>
              <strong>Legea 1/2011 (educatia)</strong> + <strong>OMEN 4742/2016 (Statutul elevului)</strong> — drepturi
              specifice scoala.
            </li>
            <li>
              <strong>Legea 544/2001</strong> — orice informatie publica (buget scoala, contracte, decizii). Cerere
              scrisa, raspuns in 10-30 zile.
            </li>
            <li>
              <strong>Comitetul de Parinti</strong> — alegeri anuale, drept de veto pe deciziile administrative ale
              scolii. Implica-te.
            </li>
          </ul>
        </Chapter>

        <Chapter number={5} id="implica-copilul" title="Implica-ti copilul">
          <p>
            Cea mai puternica lectie civica pe care i-o poti da copilului: <strong>arata-i ca societatea functioneaza</strong>.
            Nu doar din manual.
          </p>

          <ol>
            <li>
              <strong>Lasa-l sa faca poza.</strong> Telefonul tau, mana lui. Ii creste atentia fata de mediu.
            </li>
            <li>
              <strong>Discutati descrierea impreuna.</strong> „Cum descriem problema?". Invata sa formuleze concis.
            </li>
            <li>
              <strong>Arata-i cand trimiti emailul.</strong> Procesul devine real, nu abstract.
            </li>
            <li>
              <strong>Cititi raspunsul oficial impreuna.</strong> Reactia primariei + statusul confirma ca efortul
              conteaza.
            </li>
            <li>
              <strong>Sarbatoriti reparatia.</strong> Mergi cu el sa vada groapa astupata / semaforul nou. Loop civic
              inchis = lectie permanenta.
            </li>
          </ol>

          <Callout type="success" title="Confidentialitate copil">
            Pe Civia publica, numele tau apare anonim ca [nume], adresa ca [adresa]. Copilul nu e niciodata expus in
            sesizarile publice. Datele complete (nume real + adresa) sunt obligatorii doar in emailul oficial catre
            primarie — cerinta legala pentru ca sesizarea sa fie tratata.
          </Callout>
        </Chapter>
      </GhidLayout>
    </>
  );
}
