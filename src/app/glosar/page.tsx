import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { GLOSAR, GLOSAR_CATEGORII, type GlosarTerm } from "@/data/glosar";
import {
  BreadcrumbJsonLd,
  FaqJsonLd,
  DefinedTermSetJsonLd,
} from "@/components/FaqJsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export const metadata: Metadata = {
  title: "Glosar civic românesc — 50+ termeni explicați (OG 27/2002, sesizări, petiții) | Civia",
  description:
    "Glosar civic complet pentru cetățeni români: sesizare, petiție, reclamație, contencios administrativ, Avocatul Poporului, OG 27/2002, Legea 544/2001 — definiții concise + temei legal + sinonime.",
  alternates: { canonical: "/glosar" },
  keywords: [
    "glosar civic",
    "ce inseamna sesizare",
    "ce inseamna petitie",
    "diferenta sesizare petitie",
    "og 27 2002 explicat",
    "contestatie administrativa",
    "avocatul poporului",
    "drept cetatean roman",
  ],
};

const FAQ_GLOSAR = [
  {
    question: "Care e diferența între sesizare și petiție?",
    answer:
      "Sesizarea raportează o problemă concretă (groapă, parcare ilegală, gunoi) către o autoritate, iar petiția cere o schimbare colectivă (lege, politică publică) semnată de mulți cetățeni. Ambele sunt protejate de Constituție + OG 27/2002.",
  },
  {
    question: `Ce înseamnă „tăcere administrativă"?`,
    answer:
      "Refuzul tacit — autoritatea nu răspunde în 30 de zile la sesizarea ta. Este considerat refuz și deschide dreptul la contencios administrativ (acțiune în instanță), conform Legii 554/2004.",
  },
  {
    question: "Ce e contenciosul administrativ?",
    answer:
      "Procedura prin care un cetățean dă în judecată o autoritate publică pentru un act administrativ. Începe cu o cerere prealabilă, apoi acțiune la Tribunal sau Curtea de Apel. Reglementat de Legea 554/2004.",
  },
  {
    question: "Trebuie să mă identific cu numele real pentru sesizare?",
    answer:
      "Da. OG 27/2002 art. 7 spune că petițiile anonime pot fi clasate fără răspuns. Numele și adresa sunt obligatorii pentru ca autoritatea să fie obligată legal să răspundă.",
  },
];

function TermCard({ term }: { term: GlosarTerm }) {
  const categorie = GLOSAR_CATEGORII[term.categorie];
  return (
    <article
      id={term.slug}
      className="lc-glass-2 rounded-3xl p-5 hover:shadow-[var(--shadow-2)] transition-shadow scroll-mt-24"
    >
      <header className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold text-[var(--color-text)]">
          {term.termen}
        </h3>
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text)]"
          aria-label={`Categorie: ${categorie.label}`}
        >
          <span aria-hidden="true">{categorie.emoji}</span>
          {categorie.label}
        </span>
      </header>
      <p className="text-sm text-[var(--color-text)] leading-relaxed mb-3">
        {term.definitie}
      </p>
      {term.detaliu && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3 italic">
          {term.detaliu}
        </p>
      )}
      <footer className="flex flex-wrap gap-3 text-xs items-center">
        {term.temeiLegal && (
          <span className="inline-flex items-center gap-1 text-[var(--color-primary)] font-medium">
            <BookOpen size={12} aria-hidden="true" />
            {term.temeiLegal}
          </span>
        )}
        {term.sinonime && term.sinonime.length > 0 && (
          <span className="text-[var(--color-text-muted)]">
            <span className="font-semibold">Vezi și:</span>{" "}
            {term.sinonime.map((s, i) => {
              const linked = GLOSAR.find((t) => t.slug === s || t.termen.toLowerCase() === s.toLowerCase());
              return (
                <span key={s}>
                  {linked ? (
                    <a
                      href={`#${linked.slug}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {linked.termen}
                    </a>
                  ) : (
                    s
                  )}
                  {i < term.sinonime!.length - 1 && ", "}
                </span>
              );
            })}
          </span>
        )}
      </footer>
    </article>
  );
}

export default function GlosarPage() {
  const grouped = (Object.keys(GLOSAR_CATEGORII) as Array<keyof typeof GLOSAR_CATEGORII>).map(
    (cat) => ({
      cat,
      meta: GLOSAR_CATEGORII[cat],
      terms: GLOSAR.filter((t) => t.categorie === cat).sort((a, b) =>
        a.termen.localeCompare(b.termen, "ro")
      ),
    })
  );

  return (
    <div className="lc-canvas lc-canvas--flat">
    <div className="container-narrow py-8 md:py-12 max-w-5xl">
      <DefinedTermSetJsonLd
        name="Glosar civic românesc"
        description="50+ termeni civici esențiali: sesizare, petiție, OG 27/2002, Avocatul Poporului, contencios administrativ — cu definiție și temei legal."
        url={`${SITE_URL}/glosar`}
        terms={GLOSAR.map((t) => ({
          slug: t.slug,
          termen: t.termen,
          definitie: t.definitie,
          temeiLegal: t.temeiLegal,
          sinonime: t.sinonime,
        }))}
      />
      <FaqJsonLd items={FAQ_GLOSAR} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Glosar civic", url: `${SITE_URL}/glosar` },
        ]}
      />

      <PageHero
        title="Glosar civic românesc"
        icon={BookOpen}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            <strong>{GLOSAR.length} termeni</strong> civici esențiali —
            definiții concise, temei legal, sinonime. De la „sesizare" la
            „contencios administrativ", de la „OG 27/2002" la „Avocatul
            Poporului".
          </>
        }
        tagline="Sursă citabilă pentru jurnaliști, profesori și cetățeni. Actualizat săptămânal."
      />

      {/* Navigare rapidă pe categorii */}
      <nav
        aria-label="Sări la categorie"
        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 mb-8 flex flex-wrap gap-2"
      >
        {grouped.map(({ cat, meta, terms }) => (
          <a
            key={cat}
            href={`#cat-${cat}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <span aria-hidden="true">{meta.emoji}</span>
            {meta.label}
            <span className="text-[var(--color-text-muted)] font-normal">
              ({terms.length})
            </span>
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        {grouped.map(({ cat, meta, terms }) => (
          <section key={cat} id={`cat-${cat}`} aria-labelledby={`h-${cat}`} className="scroll-mt-24">
            <h2
              id={`h-${cat}`}
              className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4 flex items-center gap-2"
            >
              <span aria-hidden="true">{meta.emoji}</span>
              {meta.label}
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                ({terms.length} termeni)
              </span>
            </h2>
            <div className="lc-stagger grid md:grid-cols-2 gap-4">
              {terms.map((t) => (
                <TermCard key={t.slug} term={t} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* FAQ secțiune */}
      <section aria-labelledby="faq-glosar" className="mt-12 pt-8 border-t border-[var(--color-border)]">
        <h2 id="faq-glosar" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
          🤔 Întrebări frecvente
        </h2>
        <div className="lc-stagger space-y-3">
          {FAQ_GLOSAR.map((q) => (
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
              <div className="px-4 pb-4 pt-1 text-sm text-[var(--color-text)] leading-relaxed">
                {q.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Lipsește un termen?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5 max-w-md mx-auto">
          Glosarul Civia e deschis. Trimite sugestii la{" "}
          <a
            href="mailto:contact@civia.ro"
            className="text-[var(--color-primary)] hover:underline"
          >
            contact@civia.ro
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/cum-functioneaza"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Cum funcționează Civia
          </Link>
          <Link
            href="/og-27-2002"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--color-border)] font-bold hover:border-[var(--color-primary)] transition-colors"
          >
            OG 27/2002 explicat
          </Link>
        </div>
      </section>
    </div>
    </div>
  );
}
