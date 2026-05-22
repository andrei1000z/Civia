import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Calendar, ArrowRight, Code2 } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { ACTUALIZARI, CATEGORIE_META, type ActualizareCategorie } from "@/data/actualizari";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 86400; // 1 day

export const metadata: Metadata = {
  title: "Actualizări — istoric versiuni Civia",
  description:
    "Toate actualizările Civia: ce am adăugat, ce am reparat, când. Istoric public versiuni cu schimbări concrete — funcții noi, bug fixes, îmbunătățiri UX, performanță și securitate.",
  alternates: { canonical: "/actualizari" },
  keywords: [
    "civia actualizari",
    "civia changelog",
    "civia versiuni",
    "civia istoric",
    "civia release notes",
  ],
};

/**
 * Format dată Românească: „23 mai 2026".
 */
const LUNI_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatDataRo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${LUNI_RO[d.getMonth()]} ${d.getFullYear()}`;
}

function CategoryBadge({ categorie }: { categorie: ActualizareCategorie }) {
  const meta = CATEGORIE_META[categorie];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
      style={{ background: meta.bg, color: meta.color }}
      aria-label={`Categorie: ${meta.label}`}
    >
      {meta.label}
    </span>
  );
}

export default function ActualizariPage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Actualizări", url: `${SITE_URL}/actualizari` },
        ]}
      />

      <PageHero
        title="Actualizări"
        icon={Sparkles}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Tot ce am schimbat în Civia, versiune cu versiune. Funcții noi,
            reparări de bug-uri, îmbunătățiri de performanță și securitate —
            transparente public.
          </>
        }
        tagline="Civia evoluează rapid · Open-source · Schimbări la fiecare release"
      />

      {/* Stats compact */}
      <section
        aria-label="Sumar versiuni"
        className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10"
      >
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Versiune curentă
          </p>
          <p className="text-2xl font-bold font-[family-name:var(--font-sora)] text-[var(--color-primary)]">
            v{ACTUALIZARI[0]?.versiune ?? "0.0.0"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {ACTUALIZARI[0] ? formatDataRo(ACTUALIZARI[0].data) : "—"}
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Total versiuni
          </p>
          <p className="text-2xl font-bold font-[family-name:var(--font-sora)]">
            {ACTUALIZARI.length}
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hidden md:block">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Schimbări totale
          </p>
          <p className="text-2xl font-bold font-[family-name:var(--font-sora)]">
            {ACTUALIZARI.reduce((sum, a) => sum + a.schimbari.length, 0)}
          </p>
        </div>
      </section>

      {/* Timeline versiuni */}
      <section aria-label="Istoric actualizări" className="space-y-8">
        {ACTUALIZARI.map((actualizare, idx) => (
          <article
            key={actualizare.versiune}
            id={`v${actualizare.versiune}`}
            className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6 shadow-[var(--shadow-1)] scroll-mt-24"
          >
            {/* Vertical timeline connector — vizibil pe desktop între
                versiuni successive */}
            {idx < ACTUALIZARI.length - 1 && (
              <div
                aria-hidden="true"
                className="hidden md:block absolute -bottom-8 left-8 w-px h-8 bg-[var(--color-border)]"
              />
            )}

            <header className="mb-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="inline-flex items-center justify-center min-w-[60px] h-7 px-2.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold font-[family-name:var(--font-sora)] tabular-nums shrink-0"
                    aria-label={`Versiunea ${actualizare.versiune}`}
                  >
                    v{actualizare.versiune}
                  </span>
                  {actualizare.major && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500">
                      <Sparkles size={10} aria-hidden="true" />
                      Release major
                    </span>
                  )}
                </div>
                <time
                  dateTime={actualizare.data}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] shrink-0"
                >
                  <Calendar size={12} aria-hidden="true" />
                  {formatDataRo(actualizare.data)}
                </time>
              </div>
              <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold leading-tight mb-1">
                {actualizare.titlu}
              </h2>
              {actualizare.descriere && (
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {actualizare.descriere}
                </p>
              )}
            </header>

            <ul className="space-y-2.5">
              {actualizare.schimbari.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CategoryBadge categorie={s.categorie} />
                  <span className="text-sm text-[var(--color-text)] leading-relaxed flex-1 min-w-0">
                    {s.text}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      {/* CTA — feedback + GitHub */}
      <section className="mt-12 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 text-center">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
          Ai o idee pentru următoarea versiune?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4 max-w-md mx-auto leading-relaxed">
          Civia se construiește cu tine. Trimite-mi feedback direct din site
          sau deschide un issue pe GitHub.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#feedback"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            Trimite feedback
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <a
            href="https://github.com/andrei1000z/Civia"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--color-border)] font-semibold hover:border-[var(--color-primary)] transition-colors"
          >
            <Code2 size={14} aria-hidden="true" />
            GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
