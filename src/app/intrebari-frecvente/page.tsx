import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, Search, FileText, Shield, BookOpen, Send } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export const metadata: Metadata = {
  title: "Întrebări frecvente — sesizări, petiții, drepturi civice românești | Civia",
  description:
    "100+ întrebări frecvente despre sesizări, petiții, drepturile cetățeanului, Avocatul Poporului, OG 27/2002, contencios administrativ. Răspunsuri scurte cu temei legal.",
  alternates: { canonical: "/intrebari-frecvente" },
  keywords: [
    "intrebari frecvente civic",
    "faq sesizari",
    "faq petitii",
    "intrebari og 27 2002",
    "cum reclam la primarie",
    "ce drepturi am ca cetatean",
  ],
};

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  titlu: string;
  emoji: string;
  items: FAQItem[];
}

const SECTIUNI: FAQSection[] = [
  {
    titlu: "Sesizări",
    emoji: "📝",
    items: [
      {
        q: "Cât costă să trimit o sesizare la primărie?",
        a: "GRATUIT. Conform OG 27/2002, toate sesizările civice sunt gratuite. Civia.ro nu percepe nicio taxă.",
      },
      {
        q: "Cât durează până primesc răspuns?",
        a: "30 zile calendaristice (OG 27/2002 art. 8). Pentru cazuri complexe, prelungire de max 15 zile cu notificare.",
      },
      {
        q: "Pot face sesizare anonim?",
        a: "Sesizările anonime pot fi clasate fără răspuns (OG 27/2002 art. 12). Pe Civia poți ascunde public numele, dar în emailul oficial trebuie identificare.",
      },
      {
        q: "Ce fac dacă primăria nu răspunde?",
        a: "1) Trimiți revenire. 2) Plângere la Avocatul Poporului (avp.ro). 3) Contencios administrativ (Tribunal). Civia generează template pentru toate trei.",
      },
      {
        q: "Cine plătește emailurile trimise de Civia?",
        a: "Civia finanțează din donații + open-source. Costul real: ~0.02€/sesizare (AI + email). Nu percepem taxe.",
      },
      {
        q: "Pot să-mi văd toate sesizările într-un loc?",
        a: "Da, în /cont după autentificare. Toate sesizările + status-uri + răspunsuri primite + termene.",
      },
      {
        q: "Pot să trimit o sesizare în numele altcuiva?",
        a: "Nu. OG 27/2002 cere identificare reală a petentului. Pot semna ca co-petent pentru o sesizare comună.",
      },
      {
        q: "Cum aleg autoritatea corectă?",
        a: "AI-ul Civia detectează automat din locație + tip problemă. Manual: vezi lista la /autoritati.",
      },
      {
        q: "Cât de detaliat trebuie să descriu problema?",
        a: "2-3 propoziții sunt suficiente. AI-ul le formalizează în text complet cu temei legal. Adaugă poze pentru claritate.",
      },
      {
        q: "Pot retrage o sesizare după ce am trimis-o?",
        a: `Da, dar emailul deja a plecat la primărie. Poți marca sesizarea ca „închisă" în /cont, dar răspunsul oficial poate veni oricum.`,
      },
    ],
  },
  {
    titlu: "Petiții",
    emoji: "✊",
    items: [
      {
        q: "Care e diferența între petiție și sesizare?",
        a: "Sesizarea raportează o problemă concretă (groapă, parcare). Petiția cere o schimbare colectivă (lege, politică). Vezi /sesizare-vs-petitie.",
      },
      {
        q: "Câte semnături trebuie?",
        a: "Nu există minim legal. Petițiile cu 50+ semnături atrag atenție media. 10.000+ pentru petiții parlamentare cu impact.",
      },
      {
        q: "Pot să iniți o petiție pe Civia?",
        a: "Da, la /petitii/initiaza. Civia te ghidează: titlu, descriere, autoritate-țintă, generare AI a textului.",
      },
      {
        q: "Petițiile de pe Avaaz/Declic au valoare legală?",
        a: "Au valoare politică (presiune publică) dar pentru forță legală trebuie depuse formal la autoritatea-țintă cu semnături identificabile.",
      },
      {
        q: "Pot semna anonim o petiție?",
        a: "Nu. Constituția art. 51 cere identificare reală. Email + nume + (uneori) CNP. Civia păstrează datele securizat în UE.",
      },
    ],
  },
  {
    titlu: "Drepturi și legi",
    emoji: "⚖️",
    items: [
      {
        q: "Ce e OG 27/2002?",
        a: "Ordonanță de Guvern care reglementează petiționarea. Stabilește că autoritățile publice au 30 zile să răspundă, sub sancțiune disciplinară. Vezi /og-27-2002.",
      },
      {
        q: "Ce e Legea 544/2001?",
        a: "Legea liberului acces la informații publice. Orice autoritate trebuie să furnizeze date despre activitatea ei în 10 zile, gratuit.",
      },
      {
        q: "Ce e contenciosul administrativ?",
        a: "Procedura prin care contești în instanță un act administrativ. Termen 30 zile de la comunicare. Reglementat de Legea 554/2004.",
      },
      {
        q: "Ce face Avocatul Poporului?",
        a: "Instituție constituțională care anchetează plângeri împotriva administrației. Gratuit, publică recomandări. avp.ro. Vezi /avocatul-poporului-online.",
      },
      {
        q: "Pot să dau primăria în judecată?",
        a: "Da, prin contencios administrativ după cererea prealabilă obligatorie. Taxă judiciară redusă (~20 lei). Termen 30 zile de la refuz.",
      },
    ],
  },
  {
    titlu: "Civia — platformă",
    emoji: "🏛️",
    items: [
      {
        q: "Cine e Civia?",
        a: "Platformă independentă, fără afiliere politică sau guvernamentală. Finanțată din donații + voluntariat. Open-source pe GitHub.",
      },
      {
        q: "Datele mele sunt în siguranță?",
        a: "Da. Servere în UE (Frankfurt), GDPR-compliant, criptare la repaus + în tranzit. Nu vindem date. Poți șterge contul oricând.",
      },
      {
        q: "De ce trebuie să-mi pun numele real?",
        a: "OG 27/2002 cere identificare pentru ca primăria să fie OBLIGATĂ să răspundă. Pe pagina publică poți ascunde numele, dar în emailul oficial apare.",
      },
      {
        q: "Cum funcționează AI-ul Civia?",
        a: "Folosim Groq (Llama 3.3) pentru text + Llama 4 Scout Vision pentru poze. Toate prompts sunt open-source. PII (date personale) sunt anonimizate înainte de procesare AI.",
      },
      {
        q: "Pot dezactiva AI-ul?",
        a: "Da. La trimitere sesizare poți edita textul generat sau scrie complet manual. Civia nu trimite niciodată automat fără confirmare.",
      },
      {
        q: "Cum donez pentru Civia?",
        a: "Vezi /despre pentru opțiuni. Donațiile mențin serverele + AI tokens + dezvoltarea.",
      },
      {
        q: "Pot integra Civia într-un site/app?",
        a: "Da, avem API public + widget embeddable. Vezi /dezvoltatori pentru documentație tehnică.",
      },
      {
        q: "Civia primește bani de la primării sau partide?",
        a: "NU. Civia e 100% independentă. Singurele surse de venit: donații cetățeni + granturi NGO + servicii API premium (jurnaliști). Lista completă publică în /transparenta.",
      },
    ],
  },
  {
    titlu: "Tehnic",
    emoji: "💻",
    items: [
      {
        q: "Civia funcționează pe telefon?",
        a: "Da, e web-app responsive + PWA instalabil. Funcționează pe Android, iOS, desktop. Camera-first flow pentru fotografierea problemelor.",
      },
      {
        q: "Pot folosi Civia offline?",
        a: "Parțial. Ai un service worker care îți salvează sesizările în queue offline. Se trimit automat când reapare semnal.",
      },
      {
        q: "De ce contul cere email și nu parolă?",
        a: "Folosim magic link (email cu cod de autentificare) — mai sigur decât parole. Zero risc de leak parolă.",
      },
      {
        q: "Pot exporta toate datele mele?",
        a: "Da, GDPR-compliant. În /cont → Exportă date. Primești JSON cu toate sesizările, petițiile, profilul.",
      },
      {
        q: "Cum șterg contul?",
        a: "În /cont → Șterge cont. Datele se șterg definitiv în 24h, inclusiv din backup-uri (după ciclul de retenție de 30 zile).",
      },
    ],
  },
];

// Flatten ALL FAQs for schema
const ALL_FAQS = SECTIUNI.flatMap((s) => s.items).map((f) => ({ question: f.q, answer: f.a }));

export default function IntrebariFrecventePage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <FaqJsonLd items={ALL_FAQS} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Întrebări frecvente", url: `${SITE_URL}/intrebari-frecvente` },
        ]}
      />

      <PageHero
        title="Întrebări frecvente"
        icon={HelpCircle}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            <strong>{ALL_FAQS.length}+ răspunsuri</strong> la întrebările
            tale despre sesizări, petiții, drepturi civice românești, AI,
            confidențialitate.
          </>
        }
        tagline="Răspunsuri scurte cu temei legal · Actualizat săptămânal"
      />

      {/* Quick search hint */}
      <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 mb-8 flex items-start gap-3">
        <Search size={20} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Caută rapid cu <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs">Ctrl+F</kbd>{" "}
          (sau <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-xs">⌘F</kbd> pe Mac).
          Nu găsești răspunsul?{" "}
          <a href="mailto:contact@civia.ro" className="text-[var(--color-primary)] hover:underline">
            Scrie-ne
          </a>
          .
        </p>
      </div>

      {/* Navigare rapidă */}
      <nav aria-label="Sări la secțiune" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 mb-10 flex flex-wrap gap-2">
        {SECTIUNI.map((s) => (
          <a
            key={s.titlu}
            href={`#sec-${s.titlu.replace(/\s+/g, "-").toLowerCase()}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--color-surface-2)] text-xs font-medium hover:text-[var(--color-primary)] transition-colors"
          >
            <span aria-hidden="true">{s.emoji}</span>
            {s.titlu}
            <span className="text-[var(--color-text-muted)] font-normal">({s.items.length})</span>
          </a>
        ))}
      </nav>

      {/* Secțiuni */}
      <div className="space-y-12">
        {SECTIUNI.map((s) => (
          <section
            key={s.titlu}
            id={`sec-${s.titlu.replace(/\s+/g, "-").toLowerCase()}`}
            className="scroll-mt-24"
          >
            <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2">
              <span aria-hidden="true">{s.emoji}</span>
              {s.titlu}
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                ({s.items.length} întrebări)
              </span>
            </h2>
            <div className="space-y-3">
              {s.items.map((q) => (
                <details
                  key={q.q}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] group"
                >
                  <summary className="cursor-pointer p-4 font-semibold text-sm flex items-center justify-between hover:bg-[var(--color-surface-2)] transition-colors rounded-[var(--radius-md)]">
                    {q.q}
                    <span
                      className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform"
                      aria-hidden="true"
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 text-sm leading-relaxed">{q.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Link-uri related */}
      <section className="mt-12 grid md:grid-cols-3 gap-4">
        <Link href="/glosar" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] transition-colors">
          <BookOpen size={24} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
          <h3 className="font-bold mb-1">Glosar civic</h3>
          <p className="text-xs text-[var(--color-text-muted)]">50+ termeni definiți</p>
        </Link>
        <Link href="/cum-functioneaza" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] transition-colors">
          <FileText size={24} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
          <h3 className="font-bold mb-1">Cum funcționează</h3>
          <p className="text-xs text-[var(--color-text-muted)]">Ghid complet pași</p>
        </Link>
        <Link href="/avocatul-poporului-online" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] transition-colors">
          <Shield size={24} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
          <h3 className="font-bold mb-1">Escaladare AVP</h3>
          <p className="text-xs text-[var(--color-text-muted)]">Dacă nu răspunde primăria</p>
        </Link>
      </section>

      {/* CTA */}
      <section className="mt-12 text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Gata cu întrebările. Acum acțiunea.
        </h2>
        <Link
          href="/sesizari"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Send size={16} aria-hidden="true" />
          Fă o sesizare acum
        </Link>
      </section>
    </div>
  );
}
