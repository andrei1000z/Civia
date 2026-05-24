import type { Metadata } from "next";
import { Sparkles, Calendar, Clock } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { CATEGORIE_META, type ActualizareCategorie } from "@/data/actualizari";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { renderMarkdown } from "@/lib/actualizari/render-markdown";
import { FooterFeedback } from "@/components/layout/FooterFeedback";
import { listActualizari } from "@/lib/actualizari/repository";

// Revalidate la 1 ora — admin poate modifica DB oricând, dar nu vrem
// query Supabase la fiecare page view.
export const revalidate = 3600;

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
 * Format dată + oră Românească: „23 mai 2026, 12:50".
 */
const LUNI_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatDataRo(iso: string): { dataText: string; oraText: string | null } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dataText: iso, oraText: null };
  const dataText = `${d.getDate()} ${LUNI_RO[d.getMonth()]} ${d.getFullYear()}`;
  // Dacă ISO conține oră (T...), afișăm
  const hasTime = iso.includes("T");
  if (!hasTime) return { dataText, oraText: null };
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return { dataText, oraText: `${h}:${m}` };
}

function CategoryBadge({ categorie }: { categorie: ActualizareCategorie }) {
  const meta = CATEGORIE_META[categorie];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0"
      style={{ background: meta.bg, color: meta.color }}
      aria-label={`Categorie: ${meta.label}`}
    >
      {meta.label}
    </span>
  );
}

export default async function ActualizariPage() {
  const ACTUALIZARI = await listActualizari();
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
        tagline="Civia evoluează rapid · Schimbări la fiecare release"
      />

      {/* Timeline versiuni */}
      <section aria-label="Istoric actualizări" className="space-y-8">
        {ACTUALIZARI.map((actualizare, idx) => {
          const { dataText, oraText } = formatDataRo(actualizare.data);

          // ─── RENDER MINIMALIST (v0.0.0 genesis) ──────────────────
          if (actualizare.minimalist) {
            return (
              <article
                key={actualizare.versiune}
                id={`v${actualizare.versiune}`}
                className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 md:p-10 shadow-[var(--shadow-2)] scroll-mt-24"
              >
                {/* Vertical connector pentru următoarele versiuni */}
                {idx < ACTUALIZARI.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 w-px h-8 bg-[var(--color-border)]"
                  />
                )}

                {/* Card centrat cu versiunea */}
                <div className="text-center mb-6">
                  <span
                    className="inline-flex items-center justify-center min-w-[80px] h-9 px-4 rounded-full bg-[var(--color-primary)] text-white text-base font-bold font-[family-name:var(--font-sora)] tabular-nums shadow-[var(--shadow-2)]"
                    aria-label={`Versiunea ${actualizare.versiune}`}
                  >
                    v{actualizare.versiune}
                  </span>
                  <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold leading-tight mt-4 mb-2">
                    {actualizare.titlu}
                  </h2>
                  <p className="inline-flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <time
                      dateTime={actualizare.data}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Calendar size={12} aria-hidden="true" />
                      {dataText}
                    </time>
                    {oraText && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={12} aria-hidden="true" />
                        {oraText}
                      </span>
                    )}
                  </p>
                </div>

                {/* Content Markdown lung jos */}
                {actualizare.continutMarkdown && (
                  <div className="text-[var(--color-text)] max-w-2xl mx-auto">
                    {renderMarkdown(actualizare.continutMarkdown)}
                  </div>
                )}
              </article>
            );
          }

          // ─── RENDER STANDARD (versiuni normale) ───────────────────
          return (
            <article
              key={actualizare.versiune}
              id={`v${actualizare.versiune}`}
              className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6 shadow-[var(--shadow-1)] scroll-mt-24"
            >
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
                      <span className="inline-flex items-center gap-1 text-[11px] sm:text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500">
                        <Sparkles size={10} aria-hidden="true" />
                        Release major
                      </span>
                    )}
                  </div>
                  <p className="inline-flex items-center gap-3 text-xs text-[var(--color-text-muted)] shrink-0">
                    <time
                      dateTime={actualizare.data}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Calendar size={12} aria-hidden="true" />
                      {dataText}
                    </time>
                    {oraText && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={12} aria-hidden="true" />
                        {oraText}
                      </span>
                    )}
                  </p>
                </div>
                <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold leading-tight mb-1">
                  {actualizare.titlu}
                </h2>
                {actualizare.descriere && (
                  <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {renderMarkdown(actualizare.descriere)}
                  </div>
                )}
              </header>

              {actualizare.schimbari.length > 0 && (
                <ul className="space-y-2.5">
                  {actualizare.schimbari.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CategoryBadge categorie={s.categorie} />
                      <span className="text-sm text-[var(--color-text)] leading-relaxed flex-1 min-w-0">
                        {renderMarkdown(s.text)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      {/* 5/23/2026 — formularul de feedback DIRECT pe pagină
          (înainte era buton care ducea la home #feedback). User cere
          frictionless: vede form, scrie, trimite. */}
      <section className="mt-12">
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-2 text-center">
            Ai o idee pentru următoarea versiune?
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto leading-relaxed text-center">
            Civia se construiește cu tine. Scrie-mi direct aici — bug, idee,
            întrebare. Răspund la fiecare.
          </p>
          <FooterFeedback />
        </div>
      </section>
    </div>
  );
}
