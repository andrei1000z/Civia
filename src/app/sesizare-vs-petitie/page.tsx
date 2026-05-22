import type { Metadata } from "next";
import Link from "next/link";
import { GitCompare, FileText, Users, Scale, Send } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 2592000; // 30 days — literal pt Next 16

export const metadata: Metadata = {
  title: "Sesizare vs Petiție — Care e diferența și ce alegi? | Civia",
  description:
    "Explicat clar: sesizarea raportează o problemă concretă (groapă, parcare), petiția cere o schimbare colectivă (lege, politică). Comparație completă + temei legal + când folosești fiecare.",
  alternates: { canonical: "/sesizare-vs-petitie" },
  keywords: [
    "diferenta sesizare petitie",
    "sesizare vs petitie",
    "ce e sesizare",
    "ce e petitie",
    "cand fac sesizare",
    "cand fac petitie",
  ],
};

const FAQ = [
  {
    question: "Pot să fac și sesizare și petiție în paralel?",
    answer:
      "Da. Sesizarea îți rezolvă problema concretă (groapa de pe strada ta), iar petiția poate cere o schimbare sistemică (program anual de asfaltare pentru tot sectorul). Cele două se completează.",
  },
  {
    question: "Trebuie să strâng semnături pentru o sesizare?",
    answer:
      "Nu. O sesizare semnată de o singură persoană are aceeași forță legală — autoritatea e obligată să răspundă în 30 zile (OG 27/2002). Co-semnatarii pot adăuga însă presiune publică.",
  },
  {
    question: "Cine răspunde la o petiție colectivă?",
    answer:
      "Depinde de adresat: petiție către Parlament (modificare lege), Guvern (Hotărâre de Guvern), primărie (Hotărâre de Consiliu Local). Termen 30 zile sau 45 pentru cazuri complexe.",
  },
  {
    question: "E adevărat că petițiile online nu au valoare legală?",
    answer:
      "Fals. Petițiile semnate online sunt valide dacă autoritatea îți poate confirma identitatea (email + nume real). Constituția art. 51 nu impune formă scrisă pe hârtie.",
  },
  {
    question: "Pot transforma o sesizare în petiție?",
    answer:
      "Da. Civia oferă pipeline-ul: dacă sesizarea ta strânge 50+ co-semnatari, primești sugestie de escaladare la petiție colectivă (vezi /petitii/initiaza).",
  },
];

interface RowProps {
  feature: string;
  sesizare: string;
  petitie: string;
}

const ROWS: RowProps[] = [
  { feature: "Scop", sesizare: "Rezolvă o problemă concretă", petitie: "Schimbă o politică publică" },
  { feature: "Exemplu", sesizare: "Groapă în strada Mihai Eminescu nr. 12", petitie: "Adoptarea unui program de asfaltare 2026" },
  { feature: "Semnături", sesizare: "1 persoană e suficient", petitie: "De la 10 până la zeci de mii" },
  { feature: "Termen răspuns", sesizare: "30 zile (OG 27/2002)", petitie: "30 zile (OG 27/2002) sau 45 cazuri complexe" },
  { feature: "Adresat către", sesizare: "Primărie, prefectură, poliție locală, CNAIR", petitie: "Parlament, Guvern, Consiliu Local" },
  { feature: "Temei legal", sesizare: "Constituția art. 51 + OG 27/2002", petitie: "Constituția art. 51 + OG 27/2002" },
  { feature: "Cost", sesizare: "GRATUIT", petitie: "GRATUIT" },
  { feature: "Form Civia", sesizare: "/sesizari", petitie: "/petitii" },
  { feature: "Identificare", sesizare: "Nume + adresă obligatorii", petitie: "Nume + email obligatorii" },
  { feature: "Confidențialitate", sesizare: "Poți ascunde numele public", petitie: "Numele apare pe lista publică" },
];

export default function SesizareVsPetitiePage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Sesizare vs Petiție", url: `${SITE_URL}/sesizare-vs-petitie` },
        ]}
      />

      <PageHero
        title="Sesizare vs Petiție — care e diferența?"
        icon={GitCompare}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Două instrumente civice diferite, ambele protejate de{" "}
            <strong>Constituția României art. 51</strong> și{" "}
            <strong>OG 27/2002</strong>. Iată cum alegi.
          </>
        }
        tagline="Tabel comparativ + 5 întrebări frecvente + exemple reale."
      />

      {/* Quick answer */}
      <section className="grid md:grid-cols-2 gap-4 mb-10">
        <div className="bg-[var(--color-surface)] border-2 border-emerald-500/30 rounded-[var(--radius-md)] p-6">
          <FileText size={28} className="text-emerald-500 mb-3" aria-hidden="true" />
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
            Sesizare
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
            Raportezi o problemă concretă la autoritatea responsabilă. Tu vrei
            să fie reparată groapa, nu să schimbi legea.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4 italic">
            „În strada Republicii nr. 14 e o groapă de 30 cm. Vă rog să o reparați."
          </p>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-500 hover:underline"
          >
            <Send size={14} aria-hidden="true" />
            Fă o sesizare
          </Link>
        </div>
        <div className="bg-[var(--color-surface)] border-2 border-violet-500/30 rounded-[var(--radius-md)] p-6">
          <Users size={28} className="text-violet-500 mb-3" aria-hidden="true" />
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
            Petiție
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
            Cer împreună cu mai mulți cetățeni o schimbare publică — politică,
            lege, hotărâre administrativă.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4 italic">
            „Solicităm adoptarea unei strategii de asfaltare pentru toate
            străzile din Sector 4 până în 2027."
          </p>
          <Link
            href="/petitii"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-500 hover:underline"
          >
            <Send size={14} aria-hidden="true" />
            Semnează / inițiază petiție
          </Link>
        </div>
      </section>

      {/* Comparison table */}
      <section aria-labelledby="comparatie" className="mb-12">
        <h2
          id="comparatie"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2"
        >
          <Scale size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
          Comparație detaliată
        </h2>
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)]">
              <tr>
                <th scope="col" className="text-left p-3 font-semibold">Caracteristică</th>
                <th scope="col" className="text-left p-3 font-semibold text-emerald-500">Sesizare</th>
                <th scope="col" className="text-left p-3 font-semibold text-violet-500">Petiție</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {ROWS.map((r) => (
                <tr key={r.feature} className="hover:bg-[var(--color-surface-2)] transition-colors">
                  <td className="p-3 font-semibold">{r.feature}</td>
                  <td className="p-3 text-[var(--color-text)]">{r.sesizare}</td>
                  <td className="p-3 text-[var(--color-text)]">{r.petitie}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exemple reale */}
      <section aria-labelledby="exemple" className="mb-12">
        <h2
          id="exemple"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4"
        >
          💡 Exemple concrete
        </h2>
        <div className="space-y-3">
          {[
            {
              situatie: "Iluminat stradal stricat de 3 luni pe strada ta",
              raspuns: "Sesizare la primăria de sector + Electrica.",
              tip: "sesizare",
            },
            {
              situatie: "Vrei interzicerea publicității stradale agresive",
              raspuns: "Petiție către Consiliul Local + Parlament.",
              tip: "petitie",
            },
            {
              situatie: "Gunoiul nu se ridică de 2 săptămâni în cartier",
              raspuns: "Sesizare la operatorul de salubritate + primărie.",
              tip: "sesizare",
            },
            {
              situatie: "Vrei piste de bicicletă pe Bulevardul Magheru",
              raspuns: "Petiție către PMB cu propunere concretă.",
              tip: "petitie",
            },
            {
              situatie: "Mașina e parcată pe trotuar de 2 zile lângă casa ta",
              raspuns: "Sesizare la Poliția Locală.",
              tip: "sesizare",
            },
          ].map((e) => (
            <div
              key={e.situatie}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 flex items-start gap-3"
            >
              <span
                className={`shrink-0 w-2 h-2 rounded-full mt-2 ${
                  e.tip === "sesizare" ? "bg-emerald-500" : "bg-violet-500"
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-sm mb-1">{e.situatie}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  →{" "}
                  <span
                    className={
                      e.tip === "sesizare" ? "text-emerald-500" : "text-violet-500"
                    }
                  >
                    {e.raspuns}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-svp" className="mb-12">
        <h2 id="faq-svp" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
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

      {/* CTA dual */}
      <section className="text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          Acum că știi diferența:
        </h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
          >
            <FileText size={16} aria-hidden="true" />
            Fă o sesizare
          </Link>
          <Link
            href="/petitii"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-violet-600 hover:bg-violet-700 text-white font-bold transition-colors"
          >
            <Users size={16} aria-hidden="true" />
            Semnează o petiție
          </Link>
        </div>
      </section>
    </div>
  );
}
