import type { Metadata } from "next";
import { GhidLayout, Chapter, Callout } from "@/components/ghiduri/GhidLayout";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Ghid cetățean — drepturile tale în relația cu administrația locală",
  description: "Petiții, informații publice, consultări, ședințe consiliu local, drepturi de contestație, Legea 544, GDPR, Ombudsman.",
  alternates: { canonical: "/ghiduri/ghid-cetatean" },
};

const chapters = [
  { id: "drepturi", title: "Drepturile tale constituționale" },
  { id: "petitii", title: "Petiții și sesizări" },
  { id: "acces-info", title: "Acces la informații publice" },
  { id: "consultari", title: "Consultări publice" },
  { id: "sedinte-cl", title: "Ședințe consiliu local" },
  { id: "contestatii", title: "Contestații și recurs" },
  { id: "gdpr", title: "Date personale (GDPR)" },
  { id: "ombudsman", title: "Avocatul Poporului" },
];

export default function GhidCetateanPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Ghiduri", url: `${SITE_URL}/ghiduri` },
          { name: "Ghid cetățean", url: `${SITE_URL}/ghiduri/ghid-cetatean` },
        ]}
      />
    <GhidLayout
      title="Drepturile tale, pe bucăți mici"
      subtitle="Primăria, consiliul local, prefectura — ce îți datorează prin lege și cum să ceri. Fără jargon juridic, doar pașii reali care funcționează."
      icon="⚖️"
      gradient="from-slate-700 via-zinc-800 to-slate-900"
      chapters={chapters}
      stats={[
        { label: "Legi relevante", value: "8+" },
        { label: "Termen răspuns cerere info", value: "10 zile" },
        { label: "Durată acțiune Tribunal", value: "6-18 luni" },
      ]}
    >
      <Chapter id="drepturi" title="Drepturile tale constituționale" number={1}>
        <p>
          Ca cetățean al României, Constituția și legile îți garantează drepturi specifice în
          relația cu administrația publică locală (primărie, consiliu local). Le poți exercita
          GRATUIT, fără avocat.
        </p>

        <h3>Drepturi fundamentale</h3>
        <ul>
          <li><strong>Art. 51 Constituție:</strong> dreptul de petiționare (OG 27/2002)</li>
          <li><strong>Art. 31 Constituție:</strong> accesul la informațiile de interes public (Legea 544/2001)</li>
          <li><strong>Art. 52 Constituție:</strong> dreptul la reparație pentru prejudiciile cauzate de autorități</li>
          <li><strong>Art. 21 Constituție:</strong> accesul la justiție (inclusiv tribunalul administrativ)</li>
        </ul>

        <Callout type="info" title="Important">
          Aceste drepturi sunt <strong>individuale</strong>: poți acționa singur, fără avocat,
          fără taxe mari. Statul trebuie să-ți răspundă.
        </Callout>
      </Chapter>

      <Chapter id="petitii" title="Petiții și sesizări (OG 27/2002)" number={2}>
        <p>
          Orice cetățean poate adresa o <strong>petiție</strong> unei autorități publice. Aceasta
          este obligată să răspundă în termen.
        </p>

        <h3>Termene legale</h3>
        <ul>
          <li><strong>30 zile</strong> calendaristice — răspuns inițial</li>
          <li><strong>+15 zile</strong> — extensie excepțională (se comunică motivul)</li>
          <li><strong>Peste termen</strong> = încălcare lege, poți acționa în instanță</li>
        </ul>

        <h3>Forma petiției</h3>
        <ul>
          <li>Scrisă (email, fizic, online)</li>
          <li>Conține datele tale de identificare</li>
          <li>Solicitare clară și concretă</li>
          <li>Semnătură (electronică sau olografă)</li>
        </ul>

        <Callout type="tip" title="Numărul de înregistrare">
          La depunerea oricărei cereri, autoritatea e <strong>obligată</strong> să-ți dea un
          număr de înregistrare. Cere-l. Fără acesta, nu poți dovedi că ai depus cererea.
        </Callout>
      </Chapter>

      <Chapter id="acces-info" title="Acces la informații publice (Legea 544/2001)" number={3}>
        <p>
          Orice autoritate publică (primărie, minister, spital, școală de stat) <strong>trebuie
          să-ți furnizeze</strong> orice informație de interes public.
        </p>

        <h3>Ce poți cere</h3>
        <ul>
          <li>Buget, execuție bugetară</li>
          <li>Contracte publice semnate (cu excepția clauzelor comerciale)</li>
          <li>Salarii ale funcționarilor publici</li>
          <li>Documente de lucru, corespondență internă</li>
          <li>Rapoarte de audit, inspecții</li>
          <li>Liste cu beneficiari de ajutoare</li>
        </ul>

        <h3>Termene</h3>
        <ul>
          <li><strong>10 zile</strong> pentru informații simple, imediat disponibile</li>
          <li><strong>30 zile</strong> pentru informații complexe care necesită cercetare</li>
        </ul>

        <h3>Cerere tip</h3>
        <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-4 my-4 text-sm font-mono not-prose">
          Către: [Autoritatea]<br/>
          <br/>
          Subsemnatul(a) [nume], CNP [cnp], în temeiul Legii 544/2001 privind<br/>
          accesul la informații de interes public, vă solicit comunicarea<br/>
          următoarelor informații:<br/>
          <br/>
          1. [ce vrei să afli]<br/>
          2. [ce vrei să afli]<br/>
          <br/>
          Vă rog să-mi comunicați răspunsul la adresa de email [email].<br/>
          <br/>
          Cu stimă,<br/>
          [nume] / [data]
        </div>

        <Callout type="warning" title="Ce nu e informație publică">
          <p>— Date personale (CNP-uri, adrese, informații medicale)</p>
          <p>— Informații clasificate (apărare națională)</p>
          <p>— Proceduri penale în curs</p>
          <p>— Secretul deliberării judiciare</p>
        </Callout>
      </Chapter>

      <Chapter id="consultari" title="Consultări publice (Legea 52/2003)" number={4}>
        <p>
          Orice act normativ de interes general (HCL, regulament, strategie) trebuie să treacă prin{" "}
          <strong>consultare publică</strong> de minim 10 zile înainte de a fi adoptat.
        </p>

        <h3>Cum participi</h3>
        <ol>
          <li>Urmărește site-ul primăriei locale, secțiunea &quot;Transparență decizională&quot;</li>
          <li>Citește proiectul de act normativ</li>
          <li>Trimite observații scrise în perioada consultării (email sau fizic)</li>
          <li>Poți participa la dezbaterea publică (dacă se organizează)</li>
        </ol>

        <h3>Ce observații au șanse</h3>
        <ul>
          <li>Concrete, cu argumente tehnice/juridice</li>
          <li>Cu propuneri alternative (nu doar critici)</li>
          <li>Care indică impact asupra cetățenilor/mediului/bugetului</li>
        </ul>
      </Chapter>

      <Chapter id="sedinte-cl" title="Ședințe consiliu local" number={5}>
        <p>
          Ședințele consiliului local sunt <strong>publice</strong>. Poți participa ca cetățean și chiar lua
          cuvântul pe anumite subiecte.
        </p>

        <h3>Program ședințe</h3>
        <ul>
          <li>Ordinare: de regulă 1-2 ori pe lună</li>
          <li>Extraordinare: la nevoie</li>
          <li>Multe primării oferă live stream pe site-ul propriu sau YouTube</li>
        </ul>

        <h3>Cum iei cuvântul</h3>
        <ol>
          <li>Te înscrii în prealabil la secretariatul consiliului local (verifică procedura pe site-ul primăriei)</li>
          <li>Specifici subiectul pe care dorești să vorbești</li>
          <li>Primești de regulă 3-5 minute la ședință</li>
        </ol>
      </Chapter>

      <Chapter id="contestatii" title="Contestații și recurs (Legea 554/2004)" number={6}>
        <p>
          Dacă ești nemulțumit de o decizie a primăriei locale (ex: ți-au respins o cerere, nu-ți răspund la
          sesizare), poți contesta.
        </p>

        <h3>Pași</h3>
        <ol>
          <li><strong>Procedura prealabilă:</strong> plângere scrisă la autoritate (max 30 zile de la decizie)</li>
          <li><strong>Dacă te refuză:</strong> acțiune la Tribunal Secția Contencios Administrativ</li>
          <li><strong>Taxă judiciară:</strong> 50 lei pentru persoane fizice</li>
          <li><strong>Termen de prescripție:</strong> 6 luni de la răspunsul (sau lipsa răspunsului) autorității</li>
        </ol>

        <Callout type="info" title="Poți câștiga daune">
          Dacă autoritatea a greșit, tribunalul poate obliga plata daunelor materiale și morale.
          Cazuri tipice: 500-5.000 lei pentru refuz sesizare, mai mult pentru decizii abuzive.
        </Callout>
      </Chapter>

      <Chapter id="gdpr" title="Date personale (GDPR)" number={7}>
        <p>
          Primăria locală prelucrează multe date personale: de la CNP-ul tău, la adresa, la informații
          despre taxe. Ai drepturi specifice GDPR.
        </p>

        <h3>Drepturile tale</h3>
        <ul>
          <li><strong>Acces:</strong> ce date au despre tine</li>
          <li><strong>Rectificare:</strong> corectare date greșite</li>
          <li><strong>Ștergere:</strong> &quot;dreptul de a fi uitat&quot; (cu limite)</li>
          <li><strong>Portabilitate:</strong> primire date în format electronic</li>
          <li><strong>Restricție:</strong> limitare prelucrare</li>
        </ul>

        <h3>Cum depui cerere GDPR</h3>
        <ul>
          <li>Contactează responsabilul DPO (Data Protection Officer) al primăriei — datele de contact se găsesc pe site-ul oficial</li>
          <li>Răspuns în 30 zile</li>
          <li>Dacă refuză: plângere la ANSPDCP (<a href="https://dataprotection.ro" target="_blank" rel="noopener noreferrer">dataprotection.ro</a>)</li>
        </ul>
      </Chapter>

      <Chapter id="ombudsman" title="Avocatul Poporului" number={8}>
        <p>
          Când o autoritate îți încalcă drepturile, te poți adresa <strong>Avocatului Poporului</strong>.
          Gratuit, rapid, eficient.
        </p>

        <h3>Când îl contactezi</h3>
        <ul>
          <li>Sesizarea ta a fost ignorată peste 30 zile</li>
          <li>Ai primit un răspuns formal fără conținut</li>
          <li>Autoritatea a procedat abuziv</li>
          <li>Drepturile tale fundamentale au fost încălcate</li>
        </ul>

        <h3>Cum îl sesizezi</h3>
        <ul>
          <li>Online: <a href="https://avp.ro" target="_blank" rel="noopener noreferrer">avp.ro</a></li>
          <li>Email: <code>avp@avp.ro</code></li>
          <li>Telefon gratuit: 0800 810 300</li>
        </ul>

        <Callout type="tip" title="Ce face Avocatul Poporului">
          Intervine oficial la autoritate, cere explicații, publică rapoarte. În cazuri grave
          poate sesiza Curtea Constituțională sau instanțele de judecată. Recomandările lui
          sunt greu de ignorat.
        </Callout>
      </Chapter>
    </GhidLayout>
    </>
  );
}
