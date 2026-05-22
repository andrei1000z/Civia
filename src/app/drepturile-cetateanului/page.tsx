import type { Metadata } from "next";
import Link from "next/link";
import { Scale, FileText, Vote, BookOpen, Shield, Globe } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 86400 * 30;

export const metadata: Metadata = {
  title: "Drepturile cetățeanului român — 12 drepturi civice esențiale 2026 | Civia",
  description:
    "Lista completă a drepturilor civice ale cetățeanului român: petiționare, acces informații publice (L 544/2001), liberă circulație, vot, demnitate, contencios administrativ. Cu temei legal + exemple.",
  alternates: { canonical: "/drepturile-cetateanului" },
  keywords: [
    "drepturile cetateanului roman",
    "constitutia romaniei drepturi",
    "dreptul la petitionare",
    "dreptul la informatie publica",
    "legea 544 2001",
    "dreptul de a sesiza",
    "civic rights romania",
  ],
};

interface Drept {
  numar: number;
  titlu: string;
  scurt: string;
  temeiLegal: string;
  exemplu: string;
  ctaText?: string;
  ctaHref?: string;
}

const DREPTURI: Drept[] = [
  {
    numar: 1,
    titlu: "Dreptul la petiționare",
    scurt:
      "Poți cere oficial unei autorități publice să rezolve o problemă sau să-ți răspundă la o întrebare. Răspuns garantat în 30 de zile.",
    temeiLegal: "Constituția art. 51 + OG 27/2002",
    exemplu: `„Vă rog să reparați groapa de pe str. Eminescu nr. 14."`,
    ctaText: "Fă o sesizare",
    ctaHref: "/sesizari",
  },
  {
    numar: 2,
    titlu: "Dreptul la informații publice",
    scurt:
      "Orice autoritate publică e obligată să-ți furnizeze GRATUIT, în 10 zile, informații despre activitatea ei (bugete, contracte, decizii).",
    temeiLegal: "Legea 544/2001",
    exemplu:
      `„Solicit copia contractului de salubritate pe 2025." → primăria trebuie să răspundă în 10 zile.`,
    ctaText: "Vezi ghid L 544/2001",
    ctaHref: "/ghiduri",
  },
  {
    numar: 3,
    titlu: "Dreptul la vot",
    scurt:
      "De la 18 ani împliniți, vot universal, egal, direct, secret, liber exprimat. Vot la europene, parlamentare, prezidențiale, locale.",
    temeiLegal: "Constituția art. 36",
    exemplu: "Vot la primar/consiliu local — 1 vot per persoană.",
  },
  {
    numar: 4,
    titlu: "Dreptul la liberă circulație",
    scurt:
      "Pe teritoriul țării și în străinătate. Reședință și domiciliu libere. Permis de conducere recunoscut UE.",
    temeiLegal: "Constituția art. 25",
    exemplu: "Călătorie fără viză în Schengen (UE + non-UE select).",
  },
  {
    numar: 5,
    titlu: "Dreptul la demnitate și viață privată",
    scurt:
      "Inviolabilitate domiciliu, secret corespondență, protecție date personale (GDPR). Nimic nu te poate forța să dezvălui informații personale fără temei legal.",
    temeiLegal: "Constituția art. 26-28 + GDPR/L 190/2018",
    exemplu: "Nu ești obligat să răspunzi la apeluri telefonice insistente.",
  },
  {
    numar: 6,
    titlu: "Dreptul la contencios administrativ",
    scurt:
      "Dacă o autoritate publică emite un act care îți încalcă un drept, poți contesta în instanță. Termen: 30 zile de la comunicare.",
    temeiLegal: "Constituția art. 52 + Legea 554/2004",
    exemplu: "Amendă nedreaptă? Cerere prealabilă + Tribunal Contencios.",
    ctaText: "Vezi /avocatul-poporului-online",
    ctaHref: "/avocatul-poporului-online",
  },
  {
    numar: 7,
    titlu: "Dreptul la învățământ",
    scurt:
      "Învățământ general obligatoriu și gratuit. Acces la învățământ superior pe bază de competență. Limba minorităților recunoscută.",
    temeiLegal: "Constituția art. 32",
    exemplu: "Școala publică gratuită până la liceu inclusiv.",
  },
  {
    numar: 8,
    titlu: "Dreptul la ocrotirea sănătății",
    scurt:
      "Casa de asigurări sociale (CNAS) acoperă servicii medicale de bază. Asistență medicală gratuită în urgențe.",
    temeiLegal: "Constituția art. 34 + L 95/2006",
    exemplu: "Urgență la spital = gratuit. Programare la medic de familie = gratuit.",
  },
  {
    numar: 9,
    titlu: "Dreptul la grevă și asociere",
    scurt:
      "Poți crea sindicate, asociații, partide. Greva e protejată constituțional (cu excepții: armată, magistrați).",
    temeiLegal: "Constituția art. 40, 43",
    exemplu: "Asociație de proprietari, sindicat, ONG, partid politic.",
  },
  {
    numar: 10,
    titlu: "Dreptul la libera exprimare",
    scurt:
      "Libertatea opiniilor, presa, gândirea, religia. Cenzura e INTERZISĂ. Limite: defăimare, incitare la ură, secrete de stat.",
    temeiLegal: "Constituția art. 30",
    exemplu: "Postare critică pe rețele sociale = protejată constituțional.",
  },
  {
    numar: 11,
    titlu: "Dreptul la proprietate privată",
    scurt:
      "Proprietatea privată e garantată și ocrotită egal. Exproprierea doar pentru cauză de utilitate publică, cu dreaptă despăgubire stabilită de instanță.",
    temeiLegal: "Constituția art. 44",
    exemplu: "Apartamentul tău nu poate fi luat fără despăgubire egală cu valoarea de piață.",
  },
  {
    numar: 12,
    titlu: "Dreptul la mediu sănătos",
    scurt:
      "Stat obligat să asigure cadrul legal pentru exercitarea dreptului la un mediu înconjurător sănătos. Acces public la informații despre poluare.",
    temeiLegal: "Constituția art. 35 + Convenția Aarhus",
    exemplu: "Poți cere date despre calitatea aerului în orașul tău (vezi /harti?layer=air).",
    ctaText: "Vezi calitatea aerului",
    ctaHref: "/harti",
  },
];

const FAQ = [
  {
    question: "Sunt cu adevărat protejat constituțional dacă nu sunt cetățean român?",
    answer:
      "Cetățenii UE rezidenți în România beneficiază de cele mai multe drepturi (libera circulație, proprietate, mediu, contencios). Cetățenii non-UE beneficiază de drepturile fundamentale (demnitate, viață, libera circulație în limitele vizei).",
  },
  {
    question: "Ce fac dacă o autoritate îmi încalcă un drept?",
    answer:
      "Trei opțiuni progresive: 1) Sesizare/plângere către autoritatea respectivă (OG 27/2002). 2) Avocatul Poporului (gratuit, public). 3) Contencios administrativ la Tribunal (L 554/2004, termen 30 zile).",
  },
  {
    question: "Care e diferența între drepturi civice și drepturi politice?",
    answer:
      "Drepturile civice (egalitate, demnitate, liberă circulație, proprietate) sunt pentru TOȚI. Drepturile politice (vot, candidatură, ocupare funcții publice) sunt rezervate cetățenilor români. Drepturile sociale (sănătate, educație) sunt mixte.",
  },
  {
    question: "Pot să-mi exercit drepturile fără să mă identific?",
    answer:
      "Unele da (libertate de exprimare, mediu, informație publică prin solicitare scrisă anonimă cu adresă de corespondență). Altele NU — sesizarea oficială, votul, contenciosul administrativ cer identificare.",
  },
  {
    question: "Cine apără aceste drepturi în România?",
    answer:
      "1) Avocatul Poporului (avp.ro) — gratuit, recomandare publică. 2) Curtea Constituțională — controlul constituționalității legilor. 3) Tribunalele administrative — contencios. 4) Curtea Europeană a Drepturilor Omului (CEDO) — ultim resort.",
  },
];

export default function DrepturilePage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Drepturile cetățeanului", url: `${SITE_URL}/drepturile-cetateanului` },
        ]}
      />

      <PageHero
        title="Drepturile cetățeanului român"
        icon={Scale}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            <strong>12 drepturi civice esențiale</strong> conform Constituției
            României și legilor speciale. Cu temei legal, exemple concrete și
            ce faci dacă sunt încălcate.
          </>
        }
        tagline="Sursă: Constituția României · OG 27/2002 · Legea 544/2001 · L 554/2004 · GDPR"
      />

      {/* Lista 12 drepturi */}
      <section aria-labelledby="drepturi" className="mb-12">
        <h2 id="drepturi" className="sr-only">
          Cele 12 drepturi
        </h2>
        <div className="space-y-4">
          {DREPTURI.map((d) => (
            <article
              key={d.numar}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:shadow-[var(--shadow-2)] transition-shadow"
            >
              <header className="flex items-start gap-3 mb-3 flex-wrap">
                <span
                  className="shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)] text-white grid place-items-center font-bold"
                  aria-hidden="true"
                >
                  {d.numar}
                </span>
                <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold flex-1 min-w-0">
                  {d.titlu}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-primary)]">
                  <BookOpen size={10} aria-hidden="true" />
                  {d.temeiLegal}
                </span>
              </header>
              <p className="text-sm leading-relaxed mb-3">{d.scurt}</p>
              <p className="text-xs text-[var(--color-text-muted)] italic mb-3">
                💡 Exemplu: {d.exemplu}
              </p>
              {d.ctaText && d.ctaHref && (
                <Link
                  href={d.ctaHref}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {d.ctaText} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Quick navigation */}
      <section className="grid md:grid-cols-3 gap-4 mb-12">
        <Link
          href="/sesizari"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] transition-colors"
        >
          <FileText size={24} className="text-emerald-500 mb-2" aria-hidden="true" />
          <h3 className="font-bold mb-1">Folosește dreptul 1</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Fă o sesizare în 90 secunde
          </p>
        </Link>
        <Link
          href="/avocatul-poporului-online"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] transition-colors"
        >
          <Shield size={24} className="text-emerald-500 mb-2" aria-hidden="true" />
          <h3 className="font-bold mb-1">Folosește dreptul 6</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Escaladează la Avocatul Poporului
          </p>
        </Link>
        <Link
          href="/petitii"
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] transition-colors"
        >
          <Vote size={24} className="text-emerald-500 mb-2" aria-hidden="true" />
          <h3 className="font-bold mb-1">Folosește dreptul 1+9</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Semnează o petiție colectivă
          </p>
        </Link>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-drepturi" className="mb-12">
        <h2
          id="faq-drepturi"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6"
        >
          🤔 Întrebări frecvente
        </h2>
        <div className="space-y-3">
          {FAQ.map((q) => (
            <details
              key={q.question}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] group"
            >
              <summary className="cursor-pointer p-4 font-semibold text-sm flex items-center justify-between hover:bg-[var(--color-surface-2)] transition-colors rounded-[var(--radius-md)]">
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
      <section className="text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8">
        <Globe
          size={36}
          className="text-[var(--color-primary)] mx-auto mb-3"
          aria-hidden="true"
        />
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Cunoaște-ți drepturile. Folosește-le.
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5 max-w-md mx-auto">
          Civia te ajută să transformi drepturile civice în acțiuni concrete:
          sesizări, petiții, escaladare AVP, acces informații publice.
        </p>
        <Link
          href="/glosar"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <BookOpen size={16} aria-hidden="true" />
          Vezi glosarul civic complet
        </Link>
      </section>
    </div>
  );
}
