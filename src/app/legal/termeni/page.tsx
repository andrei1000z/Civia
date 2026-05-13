import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description:
    "Termeni și condiții de utilizare a platformei Civia.ro: identitatea operatorului, obligațiile utilizatorilor, moderarea conținutului, drepturile de proprietate intelectuală, limitarea răspunderii, soluționarea disputelor și legea aplicabilă — conform legislației Uniunii Europene.",
  alternates: { canonical: "/legal/termeni" },
};

export default function TermeniPage() {
  return (
    <div className="container-narrow py-12 md:py-16 max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-6"
      >
        <ChevronLeft size={16} /> Înapoi
      </Link>
      <article className="prose-civic">
        <h1 className="font-[family-name:var(--font-sora)] text-4xl font-extrabold mb-2">
          Termeni și condiții
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          Ultima actualizare: aprilie 2026
        </p>

        <p className="text-sm text-[var(--color-text-muted)] italic mb-8">
          Acest document descrie condițiile în care poți folosi platforma{" "}
          <strong>civia.ro</strong>. Folosirea serviciului implică acceptarea integrală a acestor
          termeni. Documentul este redactat conform legislației Uniunii Europene
          (Regulamentul UE 2016/679 — GDPR, Directiva 2000/31/CE — comerț electronic,
          Regulamentul UE 2022/2065 — DSA) și legislației române (Legea 365/2002 privind
          comerțul electronic, Legea 506/2004 privind ePrivacy).
        </p>

        <h2>1. Despre serviciu și identitatea operatorului</h2>
        <p>
          <strong>Civia.ro</strong> este o platformă civică gratuită care ajută cetățenii din
          România să formuleze și să urmărească sesizările către autoritățile locale, să
          semneze petiții civice și să acceseze date publice structurate.
        </p>
        <p>
          <strong>Civia.ro nu promovează niciun partid politic, nicio poziționare pe axa
          politică și nicio ideologie.</strong> Militam pentru o lume corectă, modernă și
          pentru oameni — atât. Nu primim finanțare politică, nu susținem candidați și nu
          publicăm conținut de campanie electorală.
        </p>
        <p>
          Platforma este independentă. Nu suntem afiliați Primăriei Municipiului București,
          Guvernului României, vreunui minister sau vreunei instituții publice. Folosim date
          publice (open data) și API-uri oficiale acolo unde sunt disponibile.
        </p>
        <p>
          Operatorul de date și furnizorul serviciului este o persoană fizică din România. Date
          de contact: prin formularul de la{" "}
          <Link href="/legal/confidentialitate#contact" className="text-[var(--color-primary)]">
            /legal/confidentialitate
          </Link>{" "}
          (răspunsul în maxim 30 de zile, conform art. 12 GDPR).
        </p>

        <h2>2. Eligibilitate și cont de utilizator</h2>
        <ul>
          <li>
            Pentru a folosi funcțiile de bază (citire, harți, știri) nu este necesar cont.
          </li>
          <li>
            Pentru a trimite sesizări sau a semna petiții, este necesar un cont creat prin{" "}
            <em>magic-link</em> pe email (fără parole). Trebuie să ai cel puțin{" "}
            <strong>16 ani</strong> sau acordul reprezentantului legal.
          </li>
          <li>
            Ești responsabil pentru păstrarea în siguranță a accesului la căsuța ta de email.
          </li>
        </ul>

        <h2>3. Conduita utilizatorilor</h2>
        <p>Prin folosirea platformei, te angajezi să:</p>
        <ul>
          <li>furnizezi informații adevărate și verificabile;</li>
          <li>nu postezi conținut ilegal, calomnios, defăimător, obscen, discriminatoriu sau care incită la ură ori violență;</li>
          <li>nu folosești platforma pentru spam, phishing, malware sau orice formă de abuz;</li>
          <li>nu încalci drepturile de autor, mărci înregistrate, secrete comerciale sau confidențialitatea altor persoane;</li>
          <li>nu accesezi sistemul în mod neautorizat, nu rulezi scraping masiv, nu efectuezi atacuri DoS și nu ocolești limitele de utilizare;</li>
          <li>nu promovezi servicii comerciale, partide politice, candidați sau campanii electorale;</li>
          <li>respecti drepturile celorlalți utilizatori și demnitatea funcționarilor publici menționați în sesizări.</li>
        </ul>

        <h2>4. Conținutul utilizatorilor și licență</h2>
        <p>
          <strong>Păstrezi drepturile de autor</strong> asupra conținutului pe care îl încarci
          (texte, fotografii, descrieri). Pentru a-ți putea afișa conținutul pe platformă, ne
          acorzi o licență <em>non-exclusivă, gratuită, transferabilă, valabilă în întreaga
          lume</em> de a stoca, afișa, traduce și transmite acel conținut prin servicii conexe
          (RSS, motor de căutare, API public, arhivare). Această licență încetează când îți
          ștergi contul, cu excepția conținutului deja indexat de motoare externe sau folosit
          în corespondența oficială cu autoritățile.
        </p>

        <h2>5. Moderarea conținutului (DSA — Regulamentul UE 2022/2065)</h2>
        <p>
          Conform <abbr title="Digital Services Act">Regulamentului DSA</abbr>, moderăm
          conținutul după următoarele principii:
        </p>
        <ul>
          <li>
            <strong>Notificare și acțiune:</strong> orice utilizator poate raporta conținut
            ilegal prin formularul de feedback. Răspundem în maxim 7 zile.
          </li>
          <li>
            <strong>Motivare:</strong> dacă ștergem o sesizare, comentariu sau cont, primești
            o explicație motivată pe email, cu temeiul concret (regula încălcată +
            secțiunea din termeni).
          </li>
          <li>
            <strong>Drept de apel:</strong> ai dreptul să contești decizia de moderare în
            14 zile. Apelul e analizat de o persoană umană, nu automatizat.
          </li>
          <li>
            <strong>Soluționare extrajudiciară:</strong> poți folosi platforma{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              UE-ODR
            </a>{" "}
            pentru rezolvarea disputelor.
          </li>
        </ul>

        <h2>6. Conținut interzis</h2>
        <p>Este interzis pe platformă orice conținut care:</p>
        <ul>
          <li>încalcă legi penale sau civile (calomnie, șantaj, amenințări, instigare la violență);</li>
          <li>conține date personale ale unor terți fără temei legal (numere CNP, acte, locuri exacte de muncă);</li>
          <li>promovează partide politice, candidați, mesaj electoral sau campanii politice;</li>
          <li>are caracter discriminatoriu pe criterii de etnie, religie, gen, orientare sexuală, dizabilitate, vârstă;</li>
          <li>conține pornografie, conținut sexual neconsensual sau care implică minori;</li>
          <li>încalcă drepturile de proprietate intelectuală.</li>
        </ul>

        <h2>7. Sesizări și răspunderea pentru conținut</h2>
        <p>
          <strong>Tu ești singurul responsabil</strong> pentru veridicitatea sesizărilor pe
          care le trimiți autorităților prin platformă. Civia.ro doar facilitează formularea
          și trimiterea — nu verificăm faptele expuse, nu garantăm rezolvarea, nu suntem
          parte în relația ta cu autoritatea publică. Sesizările false, abuzive sau
          discriminatorii vor fi șterse și pot fi raportate organelor competente.
        </p>

        <h2>8. Disponibilitatea serviciului</h2>
        <p>
          Platforma este oferită <em>„as is"</em> și <em>„as available"</em>. Nu garantăm
          disponibilitate continuă (uptime), absența erorilor sau adecvarea pentru un scop
          particular. Putem suspenda sau opri serviciul oricând, cu sau fără notificare,
          inclusiv pentru mentenanță, securitate sau dacă serviciul devine nesustenabil
          financiar.
        </p>

        <h2>9. Limitarea răspunderii</h2>
        <p>
          În limitele permise de legislația europeană, Civia.ro nu răspunde pentru:
        </p>
        <ul>
          <li>acțiunile sau inacțiunile autorităților publice către care trimiți sesizări;</li>
          <li>pierderi indirecte, incidentale sau speculative (lucrum cessans);</li>
          <li>conținutul postat de alți utilizatori;</li>
          <li>indisponibilități cauzate de furnizori terți (Vercel, Supabase, Groq, OpenAQ, OpenStreetMap etc.);</li>
          <li>pagube cauzate de forța majoră.</li>
        </ul>
        <p className="text-sm">
          Această clauză nu limitează răspunderea pentru dol, culpă gravă sau orice altă
          răspundere care nu poate fi exclusă conform legii imperative aplicabile (inclusiv
          drepturile consumatorilor garantate de Directiva UE 2011/83/UE).
        </p>

        <h2>10. Drepturile de proprietate intelectuală ale platformei</h2>
        <p>
          Brandingul Civia (nume, logo, identitate vizuală, design) îmi aparține mie ca
          operator. Codul-sursă este proprietate privată. Datele agregate publice (sesizări
          publice marcate ca atare, statistici) sunt licențiate <strong>CC BY 4.0</strong> —
          le poți reutiliza cu atribuire.
        </p>

        <h2>11. Modificarea termenilor</h2>
        <p>
          Putem modifica acești termeni pentru:
        </p>
        <ul>
          <li>conformitate cu modificări legislative (UE sau România);</li>
          <li>introducerea sau eliminarea de funcționalități;</li>
          <li>protejarea drepturilor utilizatorilor;</li>
          <li>corectarea erorilor materiale.</li>
        </ul>
        <p>
          Modificările materiale (cu impact asupra drepturilor tale) le anunțăm cu cel puțin{" "}
          <strong>30 de zile</strong> înainte, prin email (dacă ai cont) și prin banner pe
          platformă. Continuarea utilizării după data intrării în vigoare echivalează cu
          acceptarea. Dacă nu ești de acord, poți închide contul oricând fără penalitate.
        </p>

        <h2>12. Încetarea serviciului</h2>
        <p>
          Putem rezilia accesul tău la platformă (cu notificare motivată, conform DSA) dacă:
        </p>
        <ul>
          <li>încalci grav sau repetat acești termeni;</li>
          <li>folosești platforma în scop ilegal sau abuziv;</li>
          <li>există o cerere oficială motivată de la o autoritate competentă.</li>
        </ul>
        <p>
          Tu poți închide contul oricând, cu efect imediat, din pagina /cont. Datele tale
          personale se șterg conform politicii de confidențialitate.
        </p>

        <h2>13. Legea aplicabilă și soluționarea disputelor</h2>
        <p>
          Acestor termeni li se aplică <strong>legea română</strong>, completată cu
          legislația UE direct aplicabilă. Disputele se rezolvă, în primă fază, amiabil prin
          contactarea operatorului. În lipsa unui acord, sunt competente instanțele române
          de drept comun.
        </p>
        <p>
          Pentru consumatori, platformă de soluționare online a disputelor (UE-ODR):{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-primary)] underline"
          >
            ec.europa.eu/consumers/odr
          </a>
          . În România, ANPC: <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">anpc.ro</a>.
        </p>

        <h2>14. Dispoziții finale</h2>
        <ul>
          <li>
            <strong>Severabilitate:</strong> dacă o clauză este declarată nulă, restul
            termenilor rămân în vigoare.
          </li>
          <li>
            <strong>Renunțare:</strong> nerecunoașterea unui drept la un moment dat nu
            înseamnă renunțarea la acel drept.
          </li>
          <li>
            <strong>Cesiune:</strong> nu poți cesiona drepturile din acest contract fără
            acordul nostru scris.
          </li>
          <li>
            <strong>Limba:</strong> versiunea română este cea oficială. Traducerile (dacă
            există) sunt informative.
          </li>
        </ul>

        <p className="text-sm text-[var(--color-text-muted)] mt-10 pt-6 border-t border-[var(--color-border)]">
          Acești termeni respectă: GDPR (UE 2016/679), DSA (UE 2022/2065), Directiva ePrivacy
          (2002/58/CE), Directiva e-Commerce (2000/31/CE), Directiva privind drepturile
          consumatorilor (2011/83/UE), Legea 506/2004 (RO), Legea 365/2002 (RO).
        </p>
      </article>
    </div>
  );
}
