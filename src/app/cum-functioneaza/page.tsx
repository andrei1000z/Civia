import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Send, Mail, Clock, Shield, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { HowToJsonLd, GovernmentServiceJsonLd } from "@/components/JsonLd";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const metadata: Metadata = {
  title: "Cum trimiți o sesizare la primărie — Ghid complet 2026 | Civia",
  description:
    "Cum trimiți o sesizare oficială la primărie în România: pași concreți, termen legal (30 zile OG 27/2002), autoritatea competentă, model email, ce faci dacă nu primești răspuns. Gratuit, 90 secunde cu Civia.",
  alternates: { canonical: "/cum-functioneaza" },
  keywords: [
    "cum fac o sesizare la primarie",
    "cum reclam la primarie",
    "sesizare online romania",
    "og 27 2002",
    "termen raspuns primarie",
    "petitie online romania",
    "civia",
  ],
};

export const revalidate = 86400; // 24h

const FAQ = [
  {
    question: "Cât costă să trimit o sesizare la primărie?",
    answer:
      "GRATUIT. Conform OG 27/2002, toate sesizările civice sunt gratuite. Civia.ro nu percepe nicio taxă — folosim doar tehnologie AI și emailul tău (cu acordul tău).",
  },
  {
    question: "Trebuie să mă identific cu numele real?",
    answer:
      "DA, pentru ca primăria să fie OBLIGATĂ să răspundă (OG 27/2002 art. 12). Sesizările anonime pot fi clasificate fără răspuns. Pe Civia poți alege să-ți ascunzi numele de pe pagina publică, dar în emailul oficial către primărie numele apare obligatoriu.",
  },
  {
    question: "Cât durează până primesc răspuns?",
    answer:
      "Termenul legal este de 30 de zile calendaristice (OG 27/2002 art. 8). Pentru cazuri complexe, primăria poate prelungi cu maxim 15 zile, dar trebuie să te notifice. Civia urmărește automat răspunsul și te notifică în timp real.",
  },
  {
    question: "Ce fac dacă primăria nu răspunde în 30 de zile?",
    answer:
      "Trei opțiuni progresive: 1) Trimiți o revenire cu referință la nr. de înregistrare original. 2) Plângere la Avocatul Poporului (gratuit, online la avp.ro). 3) Acțiune în contencios administrativ (instanță) — termen 30 zile de la refuz. Civia generează template-uri pentru toate trei.",
  },
  {
    question: "Care e diferența între sesizare și petiție?",
    answer:
      "O sesizare raportează o problemă concretă către o autoritate locală (groapă, parcare, gunoi). O petiție cere o schimbare colectivă (lege, politică publică). Civia gestionează ambele: /sesizari pentru probleme individuale, /petitii pentru petiții colective.",
  },
  {
    question: "Cum aleg autoritatea corectă (primărie, prefectură, CNAIR)?",
    answer:
      "AI-ul Civia detectează automat din locație + tip problemă. Exemple: groapa pe drum național (DN) → CNAIR. Groapa pe stradă urbană → Primăria municipiului/sectorului. Parcare pe trotuar → Poliția Locală + Primăria. Manual: vezi lista la /autoritati.",
  },
  {
    question: "Pot trimite sesizarea via email tradițional?",
    answer:
      `Da, dar Civia o face automat: AI scrie textul formal, atașează poze, găsește emailul corect, trimite direct DE PE sesizari@civia.ro. Răspunsul vine tot la sesizari@civia.ro și apare pe pagina sesizării tale. Zero pași manuali după ce apeși „Trimite".`,
  },
  {
    question: "Datele mele sunt în siguranță?",
    answer:
      "Da. Servere în Uniunea Europeană (Frankfurt). GDPR-compliant. Numele și adresa ta sunt folosite DOAR în emailul către primărie (cerință legală). Nu vindem datele. Poți șterge contul oricând din /cont — toate sesizările + datele tale dispar definitiv în 24h.",
  },
  {
    question: "Cine plătește Civia?",
    answer:
      "Civia este platformă independentă, finanțată din donații + voluntariat. Open-source pe GitHub. Nu primește bani de la primării, partide sau guvern. Misiunea: democratizarea informației civice în România.",
  },
];

const STEPS = [
  {
    name: "Adaugă poze",
    text: "Fotografiază problema (groapă, parcare ilegală, gunoi, etc.) din 1-3 unghiuri. AI-ul recunoaște tipul + sugerează autoritatea responsabilă.",
  },
  {
    name: "Descrie problema",
    text: "În 2-3 propoziții. AI-ul transformă descrierea ta în text formal cu temei legal OG 27/2002. Tu doar revizuiești.",
  },
  {
    name: "Confirmă autoritățile",
    text: "Civia detectează automat 1-4 autorități competente (primărie sector + poliție locală + administrație străzi, etc.) pe baza locației + tipului problemei.",
  },
  {
    name: "Completează identitatea",
    text: "Numele + adresa ta (obligatorii legal pentru a primi răspuns). Salvate pe profil pentru sesizări viitoare.",
  },
  {
    name: "Apasă Trimite — 1 click",
    text: "Email-ul pleacă direct de pe sesizari@civia.ro către autorități. Tu nu deschizi nicio aplicație de email. Răspunsul vine automat pe pagina sesizării tale.",
  },
];

export default function CumFunctioneazaPage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <HowToJsonLd
        name="Cum trimiți o sesizare la primărie în România"
        description="Pași concreți pentru a trimite o sesizare oficială către primărie, respectând OG 27/2002, cu răspuns în 30 zile garantat."
        url={`${SITE_URL}/cum-functioneaza`}
        totalTime="PT90S"
        estimatedCost="0"
        steps={STEPS.map((s) => ({ ...s, url: `${SITE_URL}/sesizari` }))}
      />
      <GovernmentServiceJsonLd
        name="Trimitere sesizare formală către primărie"
        description="Serviciu civic gratuit pentru cetățeni români — sesizări oficiale formalizate AI, trimise direct la autoritățile competente conform OG 27/2002."
        url={`${SITE_URL}/cum-functioneaza`}
      />
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Cum funcționează", url: `${SITE_URL}/cum-functioneaza` },
        ]}
      />

      <PageHero
        title="Cum trimiți o sesizare la primărie în 90 de secunde"
        icon={Sparkles}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Civia automatizează ce ar dura 2 ore într-un proces de 90 de secunde:
            AI-ul scrie sesizarea în limbaj legal (<strong>OG 27/2002</strong>),
            detectează autoritatea competentă, trimite emailul automat. Răspunsul
            vine în <strong>30 de zile</strong>, conform legii.
          </>
        }
        tagline="Gratuit. Anonim public. Identificat oficial. Conform OG 27/2002."
      />

      <article className="space-y-12">
        {/* Step-by-step howto */}
        <section aria-labelledby="pasi-heading">
          <h2 id="pasi-heading" className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
            <span aria-hidden="true">📋</span> Cei 5 pași concreți
          </h2>
          <ol className="space-y-4">
            {STEPS.map((step, i) => (
              <li
                key={step.name}
                className="howto-step bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 flex gap-4 items-start"
              >
                <span
                  className="shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)] text-white grid place-items-center font-bold text-base"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="howto-step-name font-semibold mb-1 text-lg">{step.name}</h3>
                  <p className="howto-step-text text-sm text-[var(--color-text-muted)] leading-relaxed">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 text-center">
            <Link
              href="/sesizari"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              <Send size={16} aria-hidden="true" />
              Trimite o sesizare acum
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Ce se întâmplă după */}
        <section aria-labelledby="dupa-heading">
          <h2 id="dupa-heading" className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
            <Clock size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
            Ce se întâmplă după ce trimiți
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { day: "Ziua 0", title: "Email trimis", text: "Primăria primește email + Civia confirmă livrarea." },
              { day: "Zilele 1-3", title: "Înregistrare", text: "Primăria îți trimite nr. oficial de înregistrare." },
              { day: "Zilele 5-25", title: "Procesare", text: "Acțiune sau cerere de informații suplimentare." },
              { day: "Ziua 30 (max)", title: "Răspuns obligatoriu", text: "OG 27/2002 art. 8 — răspuns oficial scris." },
            ].map((s) => (
              <div key={s.day} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-primary)] mb-1">{s.day}</p>
                <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* De ce funcționează */}
        <section aria-labelledby="dece-heading">
          <h2 id="dece-heading" className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
            <Shield size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
            De ce funcționează cu Civia
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <CheckCircle2 size={20} className="text-emerald-500 mb-2" aria-hidden="true" />
              <h3 className="font-semibold mb-2">Temei legal OG 27/2002</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                Primăria e <strong>obligată</strong> să răspundă în 30 zile. Civia menționează explicit temeiul legal în fiecare email.
              </p>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <CheckCircle2 size={20} className="text-emerald-500 mb-2" aria-hidden="true" />
              <h3 className="font-semibold mb-2">Autoritate corectă</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                AI-ul detectează exact cine răspunde: primărie, prefectură, poliție locală, CNAIR. <strong>220+ orașe</strong> + 42 județe acoperite.
              </p>
            </div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <CheckCircle2 size={20} className="text-emerald-500 mb-2" aria-hidden="true" />
              <h3 className="font-semibold mb-2">Limbaj formal</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                Textul respectă standardele administrative. Primăria nu poate refuza pe motiv de „neclaritate".
              </p>
            </div>
          </div>
        </section>

        {/* Ce zice legea */}
        <section aria-labelledby="lege-heading" className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h2 id="lege-heading" className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4">
            ⚖️ Ce zice OG 27/2002 (text literal)
          </h2>
          <blockquote className="border-l-4 border-[var(--color-primary)] pl-4 italic text-sm leading-relaxed text-[var(--color-text)] mb-3">
            „Termenul de soluționare al petițiilor este de <strong>30 de zile</strong> de la data înregistrării petiției. Pentru petițiile complexe se poate prelungi cu cel mult <strong>15 zile</strong>, cu notificare prealabilă a petentului."
          </blockquote>
          <p className="text-xs text-[var(--color-text-muted)]">
            — OG 27/2002, art. 8.{" "}
            <Link href="/og-27-2002" className="text-[var(--color-primary)] hover:underline font-medium">
              Vezi textul integral și interpretarea →
            </Link>
          </p>
        </section>

        {/* Dacă nu răspunde */}
        <section aria-labelledby="nuraspund-heading">
          <h2 id="nuraspund-heading" className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
            <AlertTriangle size={24} className="text-amber-500" aria-hidden="true" />
            Dacă primăria nu răspunde
          </h2>
          <ol className="space-y-3 text-sm">
            <li className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-4">
              <strong>1. Trimite revenire</strong> — referință la nr. de înregistrare original. Civia generează automat textul.
            </li>
            <li className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-4">
              <strong>2. Plângere la Avocatul Poporului</strong> — gratuit, online la{" "}
              <a href="https://avp.ro" target="_blank" rel="noreferrer noopener" className="text-[var(--color-primary)] hover:underline">
                avp.ro
              </a>
              . Recomandările AVP sunt greu de ignorat.
            </li>
            <li className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-4">
              <strong>3. Acțiune în contencios administrativ</strong> — termen 30 zile de la refuz. Vezi{" "}
              <Link href="/ghiduri/ghid-cetatean" className="text-[var(--color-primary)] hover:underline">
                ghid drepturi cetățean
              </Link>
              .
            </li>
          </ol>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6">
            🤔 Întrebări frecvente
          </h2>
          <div className="space-y-3">
            {FAQ.map((q) => (
              <details key={q.question} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] group">
                <summary className="cursor-pointer p-4 font-semibold text-sm flex items-center justify-between hover:bg-[var(--color-surface-2)] transition-colors rounded-[var(--radius-md)]">
                  {q.question}
                  <span className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-sm text-[var(--color-text)] leading-relaxed">
                  {q.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="text-center py-8">
          <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-3">
            Gata? Trimite prima ta sesizare acum.
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
            90 de secunde. Zero formulare birocratice. AI face toată munca.
          </p>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-14 px-8 rounded-[var(--radius-button)] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-lg font-bold hover:brightness-110 shadow-[var(--shadow-3)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Send size={20} aria-hidden="true" />
            Fă o sesizare în 90 secunde
          </Link>
          <p className="text-xs text-[var(--color-text-muted)] mt-3">
            Gratuit · Conform OG 27/2002 · 220+ orașe acoperite
          </p>
        </section>
      </article>
    </div>
  );
}
