import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Politica de confidențialitate (GDPR)",
  description:
    "Politica de confidențialitate Civia.ro: identitatea operatorului, categoriile de date, temeiurile legale (art. 6 GDPR), termenele de păstrare, destinatari și transferuri, drepturile tale GDPR și cum le exerciți. Conform Regulamentului UE 2016/679 și Directivei ePrivacy.",
  alternates: { canonical: "/legal/confidentialitate" },
};

export default function ConfidentialitatePage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <PageHero
        title="Confidențialitate și GDPR"
        icon={ShieldCheck}
        gradient={HERO_GRADIENT.authority}
        backHref="/"
        backLabel="Înapoi acasă"
        description={
          <>
            Cum colectăm și protejăm datele tale. <strong>Zero tracking publicitar.</strong>{" "}
            Tot ce facem e conform GDPR + ePrivacy + ANSPDCP.
          </>
        }
        tagline="Ultima actualizare: mai 2026"
      />

      <article className="prose-civic mt-6">
        <p className="text-sm text-[var(--color-text-muted)] italic px-1">
          Document redactat conform Regulamentului UE 2016/679 (GDPR), Directivei
          2002/58/CE (ePrivacy), Legii 190/2018 (RO — măsuri de aplicare a GDPR) și Legii
          506/2004 (RO — ePrivacy).
        </p>

        <h2>Pe scurt (TL;DR)</h2>
        <ul>
          <li>Folosim minimul absolut de date necesare pentru ca platforma să funcționeze.</li>
          <li>Nu vindem date. Nu folosim Google Analytics sau Meta Pixel. Nu te trackăm pe alte site-uri.</li>
          <li>Datele sunt stocate în Uniunea Europeană (Supabase EU + Vercel EU).</li>
          <li>Ai toate drepturile GDPR — le poți exercita în 1 click din /cont sau prin formularul de mai jos.</li>
          <li>Civia.ro nu promovează niciun partid politic sau ideologie. Datele tale nu sunt folosite pentru profilare politică.</li>
        </ul>

        <h2>1. Operatorul de date (Data Controller)</h2>
        <p>
          Operator în sensul art. 4 pct. 7 GDPR: <strong>persoană fizică</strong> rezidentă în
          România, deținător al platformei <strong>civia.ro</strong>.
        </p>
        <p>
          Civia este o platformă civică independentă. Nu suntem afiliați PMB, vreunui
          minister, vreunui partid politic sau vreunei autorități publice. Nu primim
          finanțare politică. Datele tale nu vor fi folosite niciodată pentru a sprijini un
          candidat, partid sau campanie electorală.
        </p>
        <p>
          <strong>Date de contact pentru chestiuni privind protecția datelor:</strong>{" "}
          formularul din secțiunea „Contact" de mai jos. Răspundem la solicitările GDPR în
          maxim 30 de zile (art. 12 alin. 3 GDPR), prelungibil cu încă 60 de zile pentru
          cereri complexe (cu notificare).
        </p>
        <p>
          <strong>Responsabilul cu protecția datelor (DPO):</strong> nu am desemnat un DPO,
          deoarece nu îndeplinim condițiile de la art. 37 alin. 1 GDPR (autoritate publică,
          monitorizare la scară largă, prelucrare la scară largă a datelor sensibile).
          Solicitările GDPR sunt tratate direct de operator.
        </p>

        <h2>2. Categoriile de date colectate</h2>
        <h3>a. Date pentru sesizări (informații civice)</h3>
        <ul>
          <li><strong>Numele și prenumele</strong> (obligatoriu — autoritatea trebuie să identifice petentul, conform art. 7 OG 27/2002 privind petițiile);</li>
          <li><strong>Adresa de email</strong> (obligatoriu — autoritatea răspunde pe email, iar tu primești o copie);</li>
          <li><strong>Locația problemei</strong> (coordonate GPS, adresă, județ — selectate de tine pe hartă);</li>
          <li><strong>Descrierea problemei</strong> (text liber pe care îl scrii tu);</li>
          <li><strong>Fotografii</strong> (opțional — re-encodate în browser înainte de upload, astfel încât metadatele EXIF, inclusiv GPS-ul aparatului, sunt eliminate automat).</li>
        </ul>

        <h3>b. Date pentru cont</h3>
        <ul>
          <li><strong>Adresa de email</strong> (folosită pentru autentificare prin magic-link, fără parolă);</li>
          <li><strong>Numele afișat</strong> (pe care îl alegi tu — poate fi pseudonim).</li>
        </ul>

        <h3>c. Date tehnice (jurnal server)</h3>
        <ul>
          <li><strong>Adresa IP</strong> (pseudonimizată, păstrată maxim <strong>30 de zile</strong> pentru rate-limiting și prevenirea abuzului);</li>
          <li><strong>User-Agent</strong> (browser + OS, agregat anonimizat);</li>
          <li><strong>Cookie-uri esențiale</strong> (sesiunea Supabase, consimțământ cookie — vezi secțiunea „Cookies");</li>
          <li><strong>Date analytics minime, anonime</strong> (vizitator-ID hash din IP+UA, fără cross-site tracking).</li>
        </ul>

        <h3>d. Categorii speciale de date</h3>
        <p>
          <strong>NU colectăm intenționat date sensibile</strong> în sensul art. 9 GDPR
          (date despre sănătate, opinii politice, religioase, orientare sexuală, etnie). Dacă
          incluzi astfel de date în text-ul liber al unei sesizări, devii responsabil pentru
          temeiul legal (de obicei art. 9 alin. 2 lit. e — date făcute publice manifest de
          persoana vizată).
        </p>

        <h2>3. Temeiurile legale ale prelucrării (art. 6 GDPR)</h2>
        <table className="text-sm w-full border border-[var(--color-border)] rounded-[var(--radius-xs)] my-4">
          <thead className="bg-[var(--color-surface-2)]">
            <tr>
              <th className="text-left p-3">Activitate</th>
              <th className="text-left p-3">Temei legal</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Procesarea sesizării</td><td className="p-3">art. 6 (1)(b) — executarea unui contract (T&amp;C-uri)</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Crearea contului</td><td className="p-3">art. 6 (1)(b) — executare contract</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Trimitere email-uri tranzacționale</td><td className="p-3">art. 6 (1)(b) — executare contract</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Newsletter săptămânal</td><td className="p-3">art. 6 (1)(a) — consimțământ explicit</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Securitate, rate-limiting, anti-abuz</td><td className="p-3">art. 6 (1)(f) — interes legitim</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Statistici anonimizate</td><td className="p-3">art. 6 (1)(f) — interes legitim minimal</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Cookie-uri non-esențiale</td><td className="p-3">art. 6 (1)(a) — consimțământ (dacă aplicabil)</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3">Răspuns la solicitări legale</td><td className="p-3">art. 6 (1)(c) — obligație legală</td></tr>
          </tbody>
        </table>

        <h2>4. Cum folosim datele</h2>
        <ul>
          <li><strong>Sesizări publice:</strong> apar pe platformă cu numele tău <em>doar</em> dacă bifezi explicit „Publică pe platformă". Implicit, sesizarea e privată.</li>
          <li><strong>Comunicare cu autoritatea:</strong> emailul către autoritate îl <em>trimiți tu</em> direct (mailto:), Civia doar îl pre-completează.</li>
          <li><strong>AI Groq (procesare formal text):</strong> conținutul descrierii e trimis către API-ul Groq (servere UE) pentru a genera versiunea formală. Groq nu stochează prompturile, conform contractului lor.</li>
          <li><strong>Newsletter:</strong> doar dacă te-ai abonat explicit (bifare consimțământ). Te poți dezabona instant cu un click din orice email.</li>
          <li><strong>Statistici interne:</strong> agregate complet anonim, fără identificare.</li>
          <li><strong>Profilare automată:</strong> NU folosim profilare automatizată cu efect juridic asupra ta (art. 22 GDPR).</li>
          <li><strong>Vânzare date:</strong> NU. Niciodată. În niciun scop.</li>
        </ul>

        <h2>5. Termenele de păstrare (retention)</h2>
        <ul>
          <li><strong>Cont activ:</strong> pe durata existenței contului.</li>
          <li><strong>Cont șters:</strong> datele personale se șterg imediat. Sesizările publice rămân anonimizate (numele înlocuit cu „Cetățean").</li>
          <li><strong>Sesizări trimise prin platformă:</strong> 3 ani (termen rezonabil pentru tracking răspuns autoritate + eventual apel).</li>
          <li><strong>Logurile server și cheile de rate-limit (IP, User-Agent):</strong> maxim 30 de zile.</li>
          <li><strong>Backup-uri:</strong> 7 zile (Supabase point-in-time recovery pe plan Pro).</li>
          <li><strong>Email-uri trimise (newsletter, tranzacționale):</strong> 6 luni (jurnal de livrare Resend).</li>
          <li><strong>Statistici agregate anonime (pageviews, web vitals):</strong> 90 de zile.</li>
          <li><strong>Timeline per vizitator (debug UX, ID hash):</strong> 30 de zile.</li>
        </ul>

        <h2>6. Destinatari și împuterniciți (sub-procesori)</h2>
        <p>
          Datele tale sunt prelucrate exclusiv prin furnizori care respectă GDPR și au
          centre de date în SEE (Spațiul Economic European):
        </p>
        <ul>
          <li><strong>Vercel Inc.</strong> — hosting Next.js (regiune Frankfurt, DE) — DPA semnat;</li>
          <li><strong>Supabase</strong> — bază de date PostgreSQL + autentificare + storage (regiune EU) — DPA semnat;</li>
          <li><strong>Upstash</strong> — Redis pentru cache + rate-limiting + statistici agregate (regiune EU) — DPA semnat;</li>
          <li><strong>Groq</strong> — procesare AI text + viziune (formalizarea sesizărilor); cu clauze contractuale standard UE pentru orice transfer extra-UE;</li>
          <li><strong>Resend</strong> — trimiterea email-urilor tranzacționale (magic-link, notificări status sesizare, newsletter) — DPA conform GDPR;</li>
          <li><strong>Sentry</strong> — monitorizarea erorilor aplicației, cu PII redactat la sursă;</li>
          <li><strong>Open-Meteo, OpenStreetMap (tiles + Nominatim)</strong> — furnizori de date publice (geocoding, hărți, vreme); cererile pleacă din browser-ul tău și conțin doar coordonate / interogări de adresă, fără identificator personal;</li>
          <li><strong>ANPM (Agenția Națională pentru Protecția Mediului)</strong> — date publice despre calitatea aerului, folosite static (fără apeluri live).</li>
        </ul>
        <p>
          Toate accesurile sunt logate. Nu împărtășim date cu terți pentru marketing,
          publicitate sau profilare comercială.
        </p>

        <h2>7. Transferuri în afara SEE (art. 44–49 GDPR)</h2>
        <p>
          Prioritar, păstrăm datele în UE. Dacă apare un transfer către o țară terță
          (excepțional — ex: dacă Groq routează prin US), folosim:
        </p>
        <ul>
          <li><strong>Clauze contractuale standard (SCC)</strong> aprobate de Comisia Europeană;</li>
          <li><strong>Decizii de adecvare</strong> (UK, Elveția, Israel, Canada — dacă aplicabil);</li>
          <li><strong>Măsuri tehnice suplimentare</strong> (criptare în tranzit + în repaus).</li>
        </ul>

        <h2>8. Drepturile tale (art. 15–22 GDPR)</h2>
        <p>Conform GDPR, ai următoarele drepturi pe care le poți exercita gratuit:</p>
        <ul>
          <li>
            <strong>Dreptul de acces (art. 15):</strong> poți cere o copie a datelor tale.
            Disponibilă în 1 click pe{" "}
            <Link href="/cont" className="text-[var(--color-primary)] underline">/cont</Link>{" "}
            (butonul „Export date" descarcă JSON complet).
          </li>
          <li>
            <strong>Dreptul de rectificare (art. 16):</strong> poți edita oricând numele,
            adresa, telefonul direct din /cont.
          </li>
          <li>
            <strong>Dreptul la ștergere — „dreptul de a fi uitat" (art. 17):</strong> butonul
            „Șterge contul" din /cont șterge definitiv toate datele tale. Sesizările publice
            rămân anonimizate.
          </li>
          <li>
            <strong>Dreptul la restricționare (art. 18):</strong> ne poți cere să suspendăm
            prelucrarea, fără ștergere.
          </li>
          <li>
            <strong>Dreptul la portabilitate (art. 20):</strong> datele tale exportate sunt în
            JSON structurat, citibil de mașină.
          </li>
          <li>
            <strong>Dreptul de opoziție (art. 21):</strong> poți obiecta la prelucrarea bazată
            pe interes legitim (statistici).
          </li>
          <li>
            <strong>Dreptul de a retrage consimțământul (art. 7):</strong> oricând, cu
            efect pentru viitor (newsletter, cookie non-esențiale).
          </li>
          <li>
            <strong>Dreptul de a nu fi supus deciziilor automate (art. 22):</strong> nu
            folosim astfel de decizii.
          </li>
        </ul>

        <h2>9. Dreptul de a depune plângere</h2>
        <p>
          Dacă consideri că prelucrăm datele tale ilegal, ai dreptul să te adresezi:
        </p>
        <ul>
          <li>
            <strong>Autorității Naționale de Supraveghere a Prelucrării Datelor cu
            Caracter Personal (ANSPDCP)</strong> — autoritatea de protecție a datelor din
            România:{" "}
            <a
              href="https://www.dataprotection.ro"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              dataprotection.ro
            </a>{" "}
            · B-dul G-ral Gheorghe Magheru nr. 28-30, Sector 1, București, cod poștal 010336
            · email: <em>anspdcp[at]dataprotection.ro</em>
          </li>
          <li>
            <strong>Sau autorității de supraveghere din statul tău de reședință</strong>{" "}
            (lista completă pe{" "}
            <a
              href="https://edpb.europa.eu/about-edpb/board/members_en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              edpb.europa.eu
            </a>
            ).
          </li>
          <li>
            Sau să sesizezi direct instanțele competente.
          </li>
        </ul>

        <h2 id="cookies">10. Cookie-uri și tehnologii similare</h2>
        <p>
          Folosim doar <strong>cookie-uri strict necesare</strong> și <strong>localStorage</strong>{" "}
          pentru preferințe locale, scutite de consimțământ conform art. 5 alin. 3 al
          Directivei ePrivacy (necesare pentru funcționarea serviciului cerut de utilizator):
        </p>
        <table className="text-sm w-full border border-[var(--color-border)] rounded-[var(--radius-xs)] my-4">
          <thead className="bg-[var(--color-surface-2)]">
            <tr>
              <th className="text-left p-3">Cheie</th>
              <th className="text-left p-3">Tip</th>
              <th className="text-left p-3">Scop</th>
              <th className="text-left p-3">Durată</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3 font-mono text-xs">sb-*</td><td className="p-3">cookie HTTP</td><td className="p-3">Sesiunea Supabase (autentificare)</td><td className="p-3">7 zile</td></tr>
            {/* 5/22/2026 — theme localStorage entry eliminat (Civia foloseste dark mode permanent, fara toggle).
                5/23/2026 — county cookie + civia_county localStorage eliminate
                (selectarea județului ștearsă din UI, no longer set). */}
            <tr className="border-t border-[var(--color-border)]"><td className="p-3 font-mono text-xs">civic_cookie_consent</td><td className="p-3">localStorage</td><td className="p-3">Stochează alegerea ta privind consimțământul</td><td className="p-3">permanent (până la ștergere)</td></tr>
            <tr className="border-t border-[var(--color-border)]"><td className="p-3 font-mono text-xs">civia_vid</td><td className="p-3">localStorage</td><td className="p-3">Vizitator ID anonim (hash, fără identificare personală)</td><td className="p-3">permanent (până la ștergere)</td></tr>
          </tbody>
        </table>
        <p>
          <strong>Nu folosim:</strong> Google Analytics, Meta Pixel, TikTok Pixel, cookie-uri
          de publicitate, fingerprinting, web beacons sau tracking cross-site. Poți șterge
          oricând toate cheile de mai sus din setările browser-ului (Clear site data) sau
          retrage consimțământul prin „Preferințe cookie" din subsol.
        </p>

        <h2>11. Securitate (art. 32 GDPR)</h2>
        <ul>
          <li>Toate conexiunile sunt criptate <strong>HTTPS / TLS 1.3</strong>;</li>
          <li>Datele în repaus sunt criptate (AES-256, Supabase + Vercel KV);</li>
          <li>Autentificare fără parole — magic-link cu expirare scurtă (5 min);</li>
          <li>Politici Row-Level Security (RLS) la nivel de bază de date;</li>
          <li>Rate-limiting per IP + per cont pentru prevenirea abuzului;</li>
          <li>Sentry pentru monitorizarea erorilor (cu PII redactat);</li>
          <li>Audit-uri de securitate periodice asupra dependențelor.</li>
        </ul>

        <h2>12. Notificarea încălcărilor (art. 33–34 GDPR)</h2>
        <p>
          În caz de incident de securitate care îți afectează datele:
        </p>
        <ul>
          <li>Notificăm ANSPDCP în maxim <strong>72 de ore</strong> de la cunoaștere;</li>
          <li>Te notificăm direct (prin email) dacă incidentul prezintă risc ridicat pentru drepturile tale;</li>
          <li>Publicăm un raport de incident pe pagina de status cu măsurile luate.</li>
        </ul>

        <h2>13. Minori</h2>
        <p>
          Platforma nu este destinată copiilor sub 16 ani. Conform art. 8 GDPR și Legii
          190/2018 (RO), pentru utilizatorii sub 16 ani este necesar acordul reprezentantului
          legal. Dacă observăm un cont aparținând unui minor sub 16 ani fără acord
          parental, îl vom închide și șterge datele.
        </p>

        <h2>14. Modificări la această politică</h2>
        <p>
          Modificările materiale (ce afectează drepturile tale) le anunțăm cu cel puțin{" "}
          <strong>30 de zile</strong> înainte prin email + banner pe platformă. Pentru
          modificări minore (clarificări, corecturi), actualizăm documentul cu indicarea
          lunii. Versiunile anterioare sunt disponibile la cerere.
        </p>

        <h2 id="contact">15. Contact pentru chestiuni privind protecția datelor</h2>
        <p>
          Pentru orice întrebare, exercitarea unui drept GDPR sau o reclamație, folosește
          formularul de mai jos. Răspundem în <strong>maxim 30 de zile</strong> conform art.
          12 alin. 3 GDPR (prelungibil cu 60 de zile pentru cereri complexe, cu notificare
          motivată).
        </p>
        <FeedbackForm
          defaultTopic="gdpr"
          placeholder={`Ex: „Vreau să-mi văd/șterg datele personale", „Cerere de portabilitate (export JSON)", „Retrag consimțământul cookie-uri", „Mă opun prelucrării bazate pe interes legitim"`}
          successTitle="Solicitare GDPR primită"
        />

        <p className="text-sm text-[var(--color-text-muted)] mt-10 pt-6 border-t border-[var(--color-border)]">
          Această politică respectă: GDPR (UE 2016/679), Directiva ePrivacy (2002/58/CE),
          Legea 190/2018 (RO), Legea 506/2004 (RO), recomandările EDPB (European Data
          Protection Board) și ghidurile ANSPDCP.
        </p>
      </article>
    </div>
  );
}
