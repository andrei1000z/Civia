import type { Metadata } from "next";
import { GhidLayout, Chapter, Callout } from "@/components/ghiduri/GhidLayout";
import { HowToJsonLd } from "@/components/JsonLd";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

const FAQ_GHID_SESIZARI = [
  {
    question: "Câte zile am la dispoziție să fac sesizarea?",
    answer: "Imediat după constatare. Pentru contravenții documentate (parcare ilegală, etc.) cel mai bine în 24h cu poză + timestamp. OG 27/2002 nu impune termen de depunere.",
  },
  {
    question: "Trebuie să fiu cetățean român pentru a face sesizare?",
    answer: "Nu. Cetățenii UE și non-UE cu reședință în România pot depune sesizări. Constituția art. 51 garantează dreptul de petiționare pentru toate persoanele în relație cu autoritatea română.",
  },
  {
    question: "Pot trimite poza fără să apar eu în ea?",
    answer: "Da. De fapt, e recomandat — focusul trebuie pe problemă, nu pe tine. Civia anonimizează automat fețele dacă apar în fundal.",
  },
  {
    question: "Cât durează până se rezolvă efectiv problema?",
    answer: "Răspunsul oficial: 30 zile (OG 27/2002). Reparația efectivă: 1-3 luni pentru gropi simple, 6-12 luni pentru lucrări mari. Variază cu bugetul primăriei.",
  },
];

export const metadata: Metadata = {
  title: "Ghid sesizări — cum obții rezultate",
  description: "Cum formulezi o sesizare eficientă, cui o trimiți, cum urmărești progresul, ce faci la refuz.",
  alternates: { canonical: "/ghiduri/ghid-sesizari" },
};

const chapters = [
  { id: "ce-trece", title: "Ce sesizări trec și de ce" },
  { id: "cum-formulezi", title: "Cum formulezi corect" },
  { id: "unde-trimiti", title: "Unde trimiți sesizarea" },
  { id: "la-refuz", title: "Ce faci dacă te refuză" },
  { id: "contestatie", title: "Contestație & instanță" },
];

export default function GhidSesizariPage() {
  return (
    <>
      <HowToJsonLd
        name="Cum trimiți o sesizare civică eficientă la autorități"
        description="De la descrierea problemei la formularea cererii, trimiterea către autoritățile competente și urmărirea răspunsului în termenul legal."
        url={`${SITE_URL}/ghiduri/ghid-sesizari`}
        totalTime="PT15M"
        estimatedCost="0"
        steps={[
          {
            name: "Documentează problema cu poze și locație",
            text: "Fotografiază din 2-3 unghiuri, inclusiv un reper vizibil (nume stradă, clădire). Salvează momentul constatării — data + ora exactă sunt obligatorii pentru parcare și contravenții.",
          },
          {
            name: "Descrie faptul concret, fără dramatizare",
            text: "Exact ce vezi: „trotuarul e spart pe 3 metri, adâncime 10 cm” nu „un dezastru, cineva o să-și rupă gâtul”. Limbajul neutru primește mai multe răspunsuri favorabile.",
          },
          {
            name: "Identifică autoritatea competentă",
            text: "Sesizarea trimisă la autoritatea greșită se întoarce cu „nu este de competența noastră”. Civia generează automat destinatarii corecți pe bază de sector + tip problemă.",
          },
          {
            name: "Trimite prin email cu confirmare de primire",
            text: "Atașează pozele originale. Scrie în subiectul emailului codul Civia al sesizării pentru urmărire rapidă.",
          },
          {
            name: "Urmărește răspunsul în termenul legal (30 zile)",
            text: "Conform OG 27/2002, autoritatea are 30 de zile să răspundă, prelungibil cu 15. Dacă nu răspunde, trimite revenire. Dacă refuză, fă plângere administrativă.",
          },
        ]}
      />
      <FaqJsonLd items={FAQ_GHID_SESIZARI} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Ghiduri", url: `${SITE_URL}/ghiduri` },
          { name: "Sesizări", url: `${SITE_URL}/ghiduri/ghid-sesizari` },
        ]}
      />
      <GhidLayout
      title="Sesizări care nu sunt aruncate la coș"
      subtitle="Diferența între o sesizare ignorată și una rezolvată stă în detalii: cum formulezi, cui trimiți, ce dovezi atașezi. Ghid complet, de la prima gropă raportată până la plângerea în contencios administrativ dacă te-ai lovit de pereți."
      icon="📮"
      gradient="from-purple-600 via-fuchsia-700 to-pink-800"
      chapters={chapters}
      stats={[
        { label: "Termen legal răspuns", value: "30 zile" },
        { label: "OG 27/2002", value: "Lege" },
        { label: "Costul unei sesizări", value: "0 lei" },
      ]}
    >
      <Chapter id="ce-trece" title="Ce sesizări trec și de ce" number={1}>
        <p>
          Nu toate sesizările au aceeași șansă să fie rezolvate. Cele care <strong>trec</strong>{" "}
          au trăsături comune:
        </p>
        <ul>
          <li>Sunt <strong>concrete</strong> — au locație exactă și detalii verificabile</li>
          <li>Sunt <strong>documentate</strong> — poze, coordonate GPS, date</li>
          <li>Țin de <strong>competența autorității</strong> căreia te adresezi</li>
          <li>Sunt <strong>formulate politicos</strong> — fără jigniri sau amenințări</li>
          <li>Cer un lucru <strong>realizabil</strong> (nu &quot;rezolvați sărăcia&quot;)</li>
        </ul>

        <Callout type="warning" title="De ce sunt respinse sesizările">
          <p>— Prea generice (&quot;gropi pe toate străzile&quot;)</p>
          <p>— Aparțin altei instituții (ex: Poliție, ISU, ANAF)</p>
          <p>— Adresate autorității greșite (primărie vs consiliu județean vs prefectură)</p>
          <p>— Lipsă date de contact ale petentului</p>
        </Callout>

        <h3>Cum afli cine e responsabil?</h3>
        <p>
          <strong>Primăria locală gestionează:</strong> străzi locale, trotuare, iluminat public,
          salubritate, parcuri, școli, grădinițe, transport public local.
        </p>
        <p>
          <strong>Consiliul județean gestionează:</strong> drumuri județene, spitale județene,
          protecția copilului, aeroporturi locale.
        </p>
        <p>
          <strong>Prefectura verifică:</strong> legalitatea actelor emise de primărie și consiliul local.
        </p>
      </Chapter>

      <Chapter id="cum-formulezi" title="Cum formulezi corect" number={2}>
        <h3>Structura ideală</h3>
        <ol>
          <li><strong>Identificare petent:</strong> nume complet, adresă, CI, telefon/email</li>
          <li><strong>Obiect:</strong> &quot;Sesizare privind [problema] pe [locația]&quot;</li>
          <li><strong>Descriere factuală:</strong> ce ai observat, când, cât durează</li>
          <li><strong>Impact:</strong> cum afectează cetățenii / siguranța</li>
          <li><strong>Cerere:</strong> ce ceri concret să facă autoritatea</li>
          <li><strong>Temei legal:</strong> OG 27/2002 (obligatoriu de menționat)</li>
          <li><strong>Anexe:</strong> poze, coordonate, alte documente</li>
        </ol>

        <Callout type="tip" title="Civia te ajută cu textul">
          Pe această platformă, la <strong>Sesizări → Fă o sesizare</strong>, bagi descrierea
          colocvial (chiar și cu greșeli) și apesi <strong>Îmbunătățește textul</strong>.
          Generăm versiunea formală în limbaj juridic corect.
        </Callout>

        <h3>Formule magice</h3>
        <ul>
          <li><em>&quot;În temeiul OG 27/2002, solicit răspuns în termenul legal de 30 de zile.&quot;</em></li>
          <li><em>&quot;Vă rog să dispuneți verificarea la fața locului.&quot;</em></li>
          <li><em>&quot;Anexez fotografii relevante pentru documentare.&quot;</em></li>
        </ul>

        <h3>Ce să NU faci</h3>
        <ul>
          <li>Nu scrie în caps lock — arată agresiv</li>
          <li>Nu ameninți (&quot;mă voi plânge la primul ministru&quot;)</li>
          <li>Nu folosi jigniri sau înjurături</li>
          <li>Nu depăși 1 pagină de text</li>
        </ul>
      </Chapter>

      <Chapter id="unde-trimiti" title="Unde trimiți sesizarea" number={3}>
        <h3>Canale oficiale</h3>
        <ul>
          <li><strong>Email:</strong> caută adresa de sesizări pe site-ul primăriei tale (de regulă: registratura@primaria[localitate].ro)</li>
          <li><strong>Online:</strong> secțiunea &quot;Sesizări&quot; sau &quot;Petiții&quot; de pe site-ul primăriei</li>
          <li><strong>Telefon:</strong> verifică numărul de dispecerat/call center al primăriei locale</li>
          <li><strong>Fizic:</strong> registratura primăriei — depui cererea și primești număr de înregistrare</li>
        </ul>

        <h3>Alte autorități utile</h3>
        <ul>
          <li><strong>Prefectura județului:</strong> dacă primăria nu răspunde sau acționează ilegal</li>
          <li><strong>Consiliul județean:</strong> pentru probleme de competență județeană</li>
          <li><strong>Inspectoratul de Stat în Construcții:</strong> pentru construcții ilegale</li>
          <li><strong>Garda de Mediu:</strong> pentru poluare și probleme de mediu</li>
        </ul>

        <Callout type="info" title="Regula CC">
          <p>Trimite sesizarea <strong>CC la mai multe adrese</strong> simultan:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Primăria locală (autoritatea competentă)</li>
            <li>Prefectura județului (autoritate supraordonată)</li>
            <li>Instituția de specialitate, dacă e cazul (Garda de Mediu, ISC etc.)</li>
          </ul>
          <p className="mt-2">Crește dramatic șansele să nu &quot;se piardă&quot; cererea.</p>
        </Callout>
      </Chapter>

      <Chapter id="la-refuz" title="Ce faci dacă te refuză sau te ignoră" number={4}>
        <h3>Pasul 1: Reamintire (dacă au trecut 15 zile fără răspuns)</h3>
        <p>
          Trimite un email scurt: <em>&quot;Reamintesc sesizarea [Nr. înregistrare] din data de [data].
          Termenul legal de 30 de zile este pe cale să expire.&quot;</em>
        </p>

        <h3>Pasul 2: Escaladare la primar sau prefect</h3>
        <p>
          Dacă în 30 zile nu ai răspuns concret:
          <em>&quot;Sesizare către Primar / Prefect privind nerespectarea OG 27/2002 de către Direcția [X]&quot;</em>
        </p>

        <h3>Pasul 3: Avocatul Poporului</h3>
        <p>
          <a href="https://avp.ro" target="_blank" rel="noopener noreferrer">avp.ro</a> — dacă o autoritate
          încalcă drepturile cetățenești. Gratuit, răspuns în 30 zile.
        </p>

        <h3>Pasul 4: Plângere contravențională la Poliție (cazuri grave)</h3>
        <p>
          Dacă autoritatea <em>comite</em> o contravenție (nu doar refuză să acționeze), depui
          plângere la Poliție.
        </p>

        <Callout type="warning" title="Nu-ți pierde timpul cu...">
          <p>— Plângeri la TV (uneori ajută, de obicei te frustrează)</p>
          <p>— Facebook rants (fără valoare juridică)</p>
          <p>— Petiții online cu milioane de semnături (nu obligă legal)</p>
        </Callout>
      </Chapter>

      <Chapter id="contestatie" title="Contestație & instanță" number={5}>
        <h3>Tribunalul Contencios Administrativ</h3>
        <p>
          Ultima soluție: <strong>acționezi în instanță</strong> autoritatea care refuză să acționeze.
        </p>

        <h3>Pași concreți</h3>
        <ol>
          <li><strong>Procedura prealabilă:</strong> reclamantă scrisă la autoritate (max 30 zile de la răspuns)</li>
          <li><strong>Depunere acțiune:</strong> la Tribunal Secția Contencios Administrativ</li>
          <li><strong>Taxă judiciară:</strong> 50 lei (pentru persoane fizice)</li>
          <li><strong>Durată proces:</strong> 6-18 luni</li>
          <li><strong>Ce ceri:</strong> obligarea autorității să acționeze + daune morale</li>
        </ol>

        <Callout type="tip" title="Legi cheie">
          <ul className="list-disc pl-5 mt-1">
            <li><strong>OG 27/2002</strong> — petiții, termen 30 zile</li>
            <li><strong>Legea 544/2001</strong> — acces informații publice</li>
            <li><strong>Legea 554/2004</strong> — contencios administrativ</li>
            <li><strong>Legea 52/2003</strong> — transparență decizională</li>
          </ul>
        </Callout>

        <h3>Jurisprudență favorabilă</h3>
        <p>
          Există precedent: instanțele au obligat primării să răspundă la sesizări ignorate, cu
          daune morale de până la 2.000 lei per sesizare. Aceste cazuri sunt din ce în ce mai
          frecvente și creează jurisprudență favorabilă cetățenilor.
        </p>
      </Chapter>
    </GhidLayout>
    </>
  );
}
