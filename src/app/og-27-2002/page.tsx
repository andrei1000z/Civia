import type { Metadata } from "next";
import Link from "next/link";
import { Scale, ArrowRight, ExternalLink, Send } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { FaqJsonLd, BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const metadata: Metadata = {
  title: "OG 27/2002 — Ordonanța petițiilor explicată | Termen 30 zile primărie",
  description:
    "Ordonanța Guvernului 27/2002 obligă orice autoritate publică să răspundă la sesizările cetățenilor în 30 de zile. Text integral, comentariu pe articole, exemple concrete + model sesizare.",
  alternates: { canonical: "/og-27-2002" },
  keywords: [
    "og 27 2002",
    "ordonanta 27 2002",
    "termen raspuns primarie",
    "30 zile primarie",
    "ordonanta petitii",
    "cum cer raspuns primarie",
  ],
};

export const revalidate = 86400;

const FAQ = [
  {
    question: "Ce este OG 27/2002?",
    answer:
      "Ordonanța Guvernului nr. 27/2002 privind reglementarea activității de soluționare a petițiilor. Este legea fundamentală a comunicării cetățean-stat în România. Obligă orice autoritate publică să răspundă la sesizările semnate de cetățeni.",
  },
  {
    question: "Care e termenul legal de răspuns?",
    answer:
      "30 de zile calendaristice de la data înregistrării sesizării (art. 8 OG 27/2002). Pentru cazuri complexe, primăria poate prelungi cu maxim 15 zile, cu notificare prealabilă a petentului.",
  },
  {
    question: `Ce înseamnă „cazuri complexe"?`,
    answer:
      "Cazuri care necesită consultarea altor instituții, verificări în teren, expertize tehnice, sau care implică mai multe direcții. Primăria trebuie să-ți notifice prelungirea ÎNAINTE de expirarea celor 30 de zile inițiale.",
  },
  {
    question: "Cine plătește pentru sesizare?",
    answer:
      "NIMENI. Sesizările sunt complet gratuite, conform OG 27/2002. Niciun cetățean nu poate fi taxat pentru depunerea unei petiții oficiale.",
  },
  {
    question: "Pot trimite anonim?",
    answer:
      "OG 27/2002 art. 12 permite primăriei să clasifice fără răspuns petițiile anonime sau cele fără identificare clară. Pentru a primi răspuns OBLIGATORIU, trebuie să incluzi numele și adresa.",
  },
  {
    question: "Ce fac dacă primăria nu răspunde în 30 zile?",
    answer:
      "Trei opțiuni progresive: 1) Trimite o revenire cu referință la sesizarea originală. 2) Plângere la Avocatul Poporului (gratuit, online la avp.ro). 3) Acțiune în contencios administrativ (instanță) — termen 30 zile de la refuz sau de la expirarea termenului legal.",
  },
  {
    question: "Aplică OG 27/2002 și la prefecturi, ministerelor?",
    answer:
      "DA. OG 27/2002 se aplică la TOATE autoritățile publice: primării (locale, municipiu, sector, județ), prefecturi, ministere, agenții naționale, consilii județene, instituții descentralizate. Practic: orice instituție publică finanțată din bani publici.",
  },
  {
    question: "Ce alte legi sunt utile pentru sesizări?",
    answer:
      "L 544/2001 (acces informații publice, termen 10 zile), L 52/2003 (transparență decizională), L 554/2004 (contencios administrativ), Codul Civil + Codul Penal pentru cazuri grave.",
  },
];

export default function OG272002Page() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <FaqJsonLd items={FAQ} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "OG 27/2002", url: `${SITE_URL}/og-27-2002` },
        ]}
      />

      <PageHero
        title="OG 27/2002 — Ordonanța petițiilor"
        icon={Scale}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Ordonanța Guvernului 27/2002 privind activitatea de soluționare a petițiilor.
            Cea mai importantă lege civică din România: obligă orice autoritate publică
            să-ți răspundă în <strong>30 de zile</strong> la orice sesizare semnată.
          </>
        }
        tagline="Textul integral + ce înseamnă pentru tine + cum aplici concret."
      />

      <article className="space-y-10 mt-8">
        {/* TL;DR */}
        <section className="bg-gradient-to-br from-violet-500/10 via-[var(--color-surface)] to-[var(--color-surface)] border border-violet-500/30 rounded-[var(--radius-md)] p-6">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span aria-hidden="true">⚡</span> Pe scurt — 3 lucruri esențiale
          </h2>
          <ol className="space-y-2 text-sm">
            <li>
              <strong>1.</strong> Orice cetățean poate trimite o sesizare la orice autoritate publică, GRATUIT.
            </li>
            <li>
              <strong>2.</strong> Termenul de răspuns: <strong>30 de zile calendaristice</strong> (prelungibil cu 15).
            </li>
            <li>
              <strong>3.</strong> Lipsa răspunsului = poți reclama la Avocatul Poporului sau merge în contencios administrativ.
            </li>
          </ol>
        </section>

        {/* Articole cheie */}
        <section>
          <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6">
            📜 Articole cheie cu comentariu
          </h2>

          <div className="space-y-5">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="font-bold mb-2 text-[var(--color-primary)]">Art. 1 — Cine poate depune petiții</h3>
              <blockquote className="border-l-4 border-[var(--color-primary)] pl-3 italic text-sm leading-relaxed mb-2">
                „Prezenta ordonanță are ca obiect reglementarea modului de exercitare a dreptului de petiționare, garantat de articolul 51 din Constituție."
              </blockquote>
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong>Înseamnă:</strong> dreptul de a trimite sesizări e constituțional. Nicio autoritate nu te poate refuza pe motiv de „nu ai dreptul".
              </p>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="font-bold mb-2 text-[var(--color-primary)]">Art. 2 — Forme acceptate</h3>
              <blockquote className="border-l-4 border-[var(--color-primary)] pl-3 italic text-sm leading-relaxed mb-2">
                „Prin petiție se înțelege cererea, reclamația, sesizarea sau propunerea formulată în scris sau prin poșta electronică."
              </blockquote>
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong>Înseamnă:</strong> email-ul e VALID legal (echivalent cu scrisoare). Nu trebuie să mergi la registratură fizic.
              </p>
            </div>

            <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)] rounded-[var(--radius-md)] p-5">
              <h3 className="font-bold mb-2 text-[var(--color-primary)]">Art. 8 — Termenul de 30 de zile ⭐</h3>
              <blockquote className="border-l-4 border-[var(--color-primary)] pl-3 italic text-sm leading-relaxed mb-2">
                „Termenul de soluționare al petițiilor este de 30 de zile de la data înregistrării petiției. Pentru petițiile complexe se poate prelungi cu cel mult 15 zile, cu notificare prealabilă a petentului."
              </blockquote>
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong>Înseamnă:</strong> 30 zile calendaristice (NU lucrătoare). Dacă primăria prelungește, TREBUIE să te notifice ÎNAINTE de expirarea termenului. Tăcerea după 30+15 zile = refuz tacit.
              </p>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="font-bold mb-2 text-[var(--color-primary)]">Art. 9 — Număr de înregistrare</h3>
              <blockquote className="border-l-4 border-[var(--color-primary)] pl-3 italic text-sm leading-relaxed mb-2">
                „Petițiile vor fi înregistrate la autoritățile sau instituțiile publice cărora le sunt adresate."
              </blockquote>
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong>Înseamnă:</strong> primăria e OBLIGATĂ să-ți comunice un nr. de înregistrare. Civia urmărește automat acest nr. în răspunsurile primăriei (AI extrage pattern „nr X/AAAA").
              </p>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <h3 className="font-bold mb-2 text-[var(--color-primary)]">Art. 12 — Sesizări anonime</h3>
              <blockquote className="border-l-4 border-[var(--color-primary)] pl-3 italic text-sm leading-relaxed mb-2">
                „Petițiile anonime sau cele în care nu sunt trecute datele de identificare a petiționarului nu se iau în considerare și se clasează."
              </blockquote>
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong>Înseamnă:</strong> pentru răspuns garantat, INCLUDE numele complet + adresa de domiciliu. Pe Civia poți alege să-ți ascunzi numele pe pagina publică, dar în email apare obligatoriu.
              </p>
            </div>
          </div>
        </section>

        {/* Cum aplici concret */}
        <section className="bg-emerald-500/5 border border-emerald-500/30 rounded-[var(--radius-md)] p-6">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4">
            🎯 Cum aplici OG 27/2002 concret
          </h2>
          <ol className="space-y-3 text-sm">
            <li>
              <strong>Pasul 1:</strong> Identifică problema concretă (groapă, parcare, gunoi etc.) și locația exactă.
            </li>
            <li>
              <strong>Pasul 2:</strong> Identifică autoritatea competentă. Pe Civia AI o face automat:{" "}
              <Link href="/sesizari" className="text-[var(--color-primary)] hover:underline">/sesizari</Link>.
            </li>
            <li>
              <strong>Pasul 3:</strong> Redactează email-ul cu temei legal („solicit răspuns în 30 zile, conform OG 27/2002 art. 8").
            </li>
            <li>
              <strong>Pasul 4:</strong> Trimite. Civia trimite automat de pe sesizari@civia.ro.
            </li>
            <li>
              <strong>Pasul 5:</strong> Urmărește răspunsul. La 30 zile, dacă nu primești → escaladare AVP / contencios.
            </li>
          </ol>
        </section>

        {/* Linkuri externe */}
        <section>
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-4">
            📚 Surse oficiale
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="https://legi.justice.ro" target="_blank" rel="noreferrer noopener" className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1">
                Text integral OG 27/2002 pe legi.justice.ro
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
            <li>
              <a href="https://avp.ro" target="_blank" rel="noreferrer noopener" className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1">
                Avocatul Poporului — plângeri online
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
            <li>
              <Link href="/cum-functioneaza" className="text-[var(--color-primary)] hover:underline">
                Cum funcționează Civia — ghid complet
              </Link>
            </li>
            <li>
              <Link href="/ghiduri/ghid-cetatean" className="text-[var(--color-primary)] hover:underline">
                Ghid drepturi cetățean
              </Link>
            </li>
          </ul>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-6">
            🤔 Întrebări frecvente despre OG 27/2002
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
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-3">
            Trimite sesizarea ta acum, în baza OG 27/2002
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
            Civia generează automat email-ul oficial cu temei legal explicit.
          </p>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Send size={16} aria-hidden="true" />
            Fă o sesizare
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>
      </article>
    </div>
  );
}
