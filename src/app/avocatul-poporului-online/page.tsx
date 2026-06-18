import type { Metadata } from "next";
import Link from "next/link";
import { Shield, AlertTriangle, FileText, ExternalLink, Send, Clock, BookOpen } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { FaqJsonLd, BreadcrumbJsonLd, GovernmentServiceJsonLd } from "@/components/FaqJsonLd";
import { HowToJsonLd } from "@/components/JsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export const metadata: Metadata = {
  title: "Avocatul Poporului online — Cum escaladezi o sesizare ignorată | Civia",
  description:
    "Primăria nu răspunde în 30 de zile? Escaladează la Avocatul Poporului — gratuit, online la avp.ro. Civia generează automat plângerea cu temei legal. Ghid complet 2026.",
  alternates: { canonical: "/avocatul-poporului-online" },
  keywords: [
    "avocatul poporului",
    "plangere avocatul poporului online",
    "primaria nu raspunde",
    "ce fac daca primaria ignora sesizarea",
    "escaladare sesizare",
    "avp.ro",
    "contencios administrativ romania",
  ],
};

const STEPS = [
  {
    name: "Verifică termenul de 30 de zile",
    text: "OG 27/2002 art. 8: primăria are 30 zile (sau 45 pentru cazuri complexe cu notificare prealabilă). Dacă a expirat fără răspuns, ai dreptul la plângere.",
  },
  {
    name: "Pregătește dosarul",
    text: "Adună: numărul de înregistrare al sesizării, data depunerii, dovezi (poze, copie email). Civia le păstrează automat în profilul tău.",
  },
  {
    name: "Completează plângerea pe avp.ro",
    text: "Mergi la avp.ro → Depune o petiție → completezi formularul. Civia generează textul plângerii cu temei legal pre-completat.",
  },
  {
    name: "Trimite + așteaptă numărul",
    text: "AVP răspunde inițial în 15 zile cu confirmare. Investigația durează 30-60 zile.",
  },
  {
    name: "Dacă AVP recomandă, primăria DE OBICEI reacționează",
    text: "Recomandările AVP nu sunt juridic obligatorii, dar sunt publice. Primarii preferă să răspundă decât să apară în raportul anual AVP.",
  },
];

const FAQ = [
  {
    question: "Avocatul Poporului costă bani?",
    answer:
      "Nu. Procedura e GRATUITĂ — atât depunerea online la avp.ro cât și investigația. Constituția României art. 58-60.",
  },
  {
    question: "Cât durează o plângere la AVP?",
    answer:
      "15 zile pentru confirmare primire + 30-60 zile pentru investigație + răspuns oficial. Total: 1.5-3 luni.",
  },
  {
    question: "AVP poate forța primăria să rezolve?",
    answer:
      "Direct, nu. Dar AVP emite recomandări PUBLICE care apar în raportul anual către Parlament. Majoritatea primăriilor preferă să răspundă decât să fie expuse public.",
  },
  {
    question: "Pot face plângere și fără să fi trimis sesizare în prealabil?",
    answer:
      "Da, dar AVP întreabă prima dacă ai încercat să rezolvi direct cu autoritatea. Recomandare: depune sesizarea pe Civia, așteaptă 30 zile, apoi escaladează.",
  },
  {
    question: "Ce diferență e între AVP și contencios administrativ?",
    answer:
      "AVP: gratuit, recomandare publică, fără termen strict. Contencios administrativ: 30 zile de la refuz, taxă judiciară redusă, decizie obligatorie a Tribunalului.",
  },
  {
    question: "Pot face plângere la AVP pentru orice autoritate?",
    answer:
      "Da, pentru orice autoritate publică din România: primării, prefecturi, ministere, agenții, instituții descentralizate. Excepții: Parlament + Președinte.",
  },
  {
    question: "Civia trimite automat plângerea la AVP?",
    answer:
      "Nu încă. AVP nu acceptă plângeri prin platforme terțe — trebuie depusă personal pe avp.ro. Civia îți generează textul complet, gata de copiat.",
  },
];

export default function AvocatulPoporuluiPage() {
  return (
    <div className="lc-canvas lc-canvas--flat">
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <HowToJsonLd
        name="Cum depui plângere la Avocatul Poporului online"
        description="Pași concreți pentru a escalada o sesizare ignorată de primărie la Avocatul Poporului. Gratuit, online la avp.ro."
        url={`${SITE_URL}/avocatul-poporului-online`}
        totalTime="PT15M"
        estimatedCost="0"
        steps={STEPS.map((s) => ({ ...s, url: "https://avp.ro" }))}
      />
      <GovernmentServiceJsonLd
        name="Plângere la Avocatul Poporului — escaladare sesizare ignorată"
        description="Serviciu civic gratuit pentru cetățeni români ale căror sesizări au fost ignorate de autorități. Ghid + template generat AI."
        url={`${SITE_URL}/avocatul-poporului-online`}
      />
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Avocatul Poporului online", url: `${SITE_URL}/avocatul-poporului-online` },
        ]}
      />

      <PageHero
        title="Avocatul Poporului online"
        icon={Shield}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Primăria nu a răspuns în <strong>30 de zile</strong>? Ai dreptul
            constituțional să escaladezi la <strong>Avocatul Poporului</strong>{" "}
            — gratuit, online, public.
          </>
        }
        tagline="Constituția art. 58-60 · OG 27/2002 art. 8 · 100% gratuit · răspuns în 15-60 zile"
      />

      {/* Alert hero */}
      <section className="bg-amber-500/10 border-l-4 border-amber-500 rounded-[var(--radius-md)] p-5 mb-10 flex gap-3">
        <AlertTriangle size={24} className="text-amber-500 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-bold mb-1">Când are sens să escaladezi?</h2>
          <p className="text-sm leading-relaxed">
            DUPĂ ce a trecut termenul de 30 de zile (sau 45 cu notificare) fără
            răspuns oficial. Înainte de termen, AVP îți va spune să aștepți.
          </p>
        </div>
      </section>

      {/* Pași */}
      <section aria-labelledby="pasi-avp" className="mb-12">
        <h2
          id="pasi-avp"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6 flex items-center gap-2"
        >
          <FileText size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          5 pași concreți
        </h2>
        <ol className="space-y-4 lc-stagger">
          {STEPS.map((step, i) => (
            <li
              key={step.name}
              className="howto-step lc-glass-2 rounded-3xl p-5 flex gap-4"
            >
              <span
                className="shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)] text-white grid place-items-center font-bold"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="howto-step-name font-semibold text-lg mb-1">{step.name}</h3>
                <p className="howto-step-text text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Template plângere */}
      <section aria-labelledby="template" className="mb-12">
        <h2
          id="template"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2"
        >
          <BookOpen size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          Template plângere (copiabil)
        </h2>
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto">
{`Către: Instituția Avocatul Poporului
Domnului/Doamnei Avocat al Poporului

Subiect: Plângere refuz tacit sesizare nr. [NUMĂR ÎNREGISTRARE]

Subsemnatul/a, [NUME PRENUME], domiciliat/ă în [ADRESA], CNP [opțional],
formulez prezenta plângere împotriva [DENUMIRE PRIMĂRIE/AUTORITATE],
pentru refuzul tacit de a soluționa sesizarea înregistrată cu nr.
[NUMĂR] din data de [DATA].

În fapt:
Am depus sesizarea menționată în data de [DATA], având obiectul:
[DESCRIE PROBLEMA — ex: groapă de 30 cm pe str. Republicii nr. 14].

Conform OG 27/2002 art. 8, autoritatea avea obligația să răspundă în
termen de 30 zile, dar a depășit acest termen fără a comunica vreo
notificare sau prelungire conform art. 9.

În drept:
- Constituția României art. 51 (dreptul de petiționare);
- OG 27/2002 art. 8 (termen 30 zile);
- Legea 35/1997 art. 13 (competența Avocatului Poporului).

Solicit:
1. Investigarea cazului de către instituția dumneavoastră;
2. Recomandare publică pentru soluționarea sesizării;
3. Apariția cazului în raportul anual către Parlament dacă autoritatea
   continuă să ignore.

Anexe:
- Copie sesizare originală
- Dovadă transmitere
- Fotografii problemă

Data: [DATA]
Semnătura: [SEMNĂTURĂ]
[NUME PRENUME]
[EMAIL]
[TELEFON]`}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          ℹ️ Civia generează automat acest template pre-completat dacă sesizarea
          ta a depășit 30 zile fără răspuns. Vezi în{" "}
          <Link href="/cont" className="text-[var(--color-primary)] hover:underline">
            /cont
          </Link>
          .
        </p>
      </section>

      {/* Alternative */}
      <section aria-labelledby="alternative" className="mb-12">
        <h2
          id="alternative"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6"
        >
          📋 Și ce alte opțiuni mai am?
        </h2>
        <div className="grid md:grid-cols-3 gap-4 lc-stagger">
          <div className="lc-glass-2 rounded-3xl p-5">
            <Clock size={20} className="text-emerald-500 mb-2" aria-hidden="true" />
            <h3 className="font-semibold mb-2">1. Trimite revenire</h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Primă escaladare — un email politicos cu referință la numărul de
              înregistrare original. 40% din primării răspund la revenire.
            </p>
          </div>
          <div className="lc-glass-2 border-2 border-emerald-500/30 rounded-3xl p-5">
            <Shield size={20} className="text-emerald-500 mb-2" aria-hidden="true" />
            <h3 className="font-semibold mb-2">2. Avocatul Poporului</h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Gratuit, public, eficient. Recomandare AVP apare în raportul
              anual la Parlament — primarii preferă să răspundă.
            </p>
          </div>
          <div className="lc-glass-2 rounded-3xl p-5">
            <FileText size={20} className="text-amber-500 mb-2" aria-hidden="true" />
            <h3 className="font-semibold mb-2">3. Contencios administrativ</h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Acțiune la Tribunal (L 554/2004). Termen: 30 zile de la refuz.
              Taxă: ~20 lei. Decizie obligatorie. Recomandat doar pentru cazuri
              mari.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-avp" className="mb-12">
        <h2 id="faq-avp" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
          🤔 Întrebări frecvente
        </h2>
        <div className="space-y-3 lc-stagger">
          {FAQ.map((q) => (
            <details
              key={q.question}
              className="lc-glass-2 rounded-3xl group"
            >
              <summary className="cursor-pointer p-4 font-semibold text-sm flex items-center justify-between hover:bg-[var(--color-surface-2)] transition-colors rounded-3xl">
                {q.question}
                <span
                  className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
                  aria-hidden="true"
                >
                  ▼
                </span>
              </summary>
              <div className="px-4 pb-4 pt-1 text-sm leading-relaxed">
                {q.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center lc-glass-2 rounded-3xl p-8">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Începe cu o sesizare prima oară
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
          AVP cere dovadă că ai încercat să rezolvi direct. Civia depune sesizarea
          + urmărește termenul + generează plângerea AVP dacă e nevoie.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Send size={16} aria-hidden="true" />
            Fă o sesizare acum
          </Link>
          <a
            href="https://avp.ro/depune-petitie"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--color-border)] font-bold hover:border-[var(--color-primary)] transition-colors"
          >
            avp.ro — depune petiție
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
    </div>
  );
}
