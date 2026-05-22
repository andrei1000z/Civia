import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Send, BookOpen, AlertCircle, ArrowRight, Clock } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { CUM_FAC_TIPURI } from "@/data/cum-fac-tipuri";
import { HowToJsonLd } from "@/components/JsonLd";
import { FaqJsonLd, BreadcrumbJsonLd, GovernmentServiceJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export async function generateStaticParams() {
  return CUM_FAC_TIPURI.map((t) => ({ tip: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tip: string }>;
}): Promise<Metadata> {
  const { tip } = await params;
  const t = CUM_FAC_TIPURI.find((x) => x.slug === tip);
  if (!t) return { title: "Pagină negăsită" };
  return {
    title: `Cum fac sesizare pentru ${t.titlu.toLowerCase()} — ghid 2026 | Civia`,
    description: t.metaDescription,
    alternates: { canonical: `/cum-fac/${t.slug}` },
    keywords: t.keywords,
  };
}

export default async function CumFacTipPage({
  params,
}: {
  params: Promise<{ tip: string }>;
}) {
  const { tip } = await params;
  const t = CUM_FAC_TIPURI.find((x) => x.slug === tip);
  if (!t) notFound();

  const pageUrl = `${SITE_URL}/cum-fac/${t.slug}`;

  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <HowToJsonLd
        name={`Cum fac sesizare pentru ${t.titlu.toLowerCase()}`}
        description={t.metaDescription}
        url={pageUrl}
        totalTime="PT90S"
        estimatedCost="0"
        steps={t.pasi.map((s) => ({
          name: s.titlu,
          text: s.text,
          url: `${SITE_URL}/sesizari`,
        }))}
      />
      <GovernmentServiceJsonLd
        name={`Sesizare pentru ${t.titlu.toLowerCase()}`}
        description={`Serviciu civic gratuit pentru raportarea problemei: ${t.titlu.toLowerCase()}. Email automat către ${t.autoritate}.`}
        url={pageUrl}
      />
      {t.faq.length > 0 && <FaqJsonLd items={t.faq.map((f) => ({ question: f.q, answer: f.a }))} />}
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Ghiduri sesizări", url: `${SITE_URL}/cum-fac` },
          { name: t.titlu, url: pageUrl },
        ]}
      />

      <PageHero
        title={`Cum fac sesizare pentru ${t.titlu.toLowerCase()}`}
        icon={Send}
        gradient={HERO_GRADIENT.primary}
        backHref="/cum-fac"
        backLabel="Toate ghidurile"
        description={
          <>
            <span aria-hidden="true">{t.emoji}</span> Ghid complet pentru
            raportarea unei probleme de tip <strong>{t.titlu.toLowerCase()}</strong>.
            Autoritate competentă: <strong>{t.autoritate}</strong>.
          </>
        }
        tagline={`Gratuit · ${t.termenRaspuns} · Conform ${t.temeiLegal}`}
      />

      {/* Info esențială */}
      <section className="grid sm:grid-cols-3 gap-4 mb-12">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Autoritate
          </p>
          <p className="text-sm font-semibold">{t.autoritate}</p>
          {t.autoritatiSecundare && t.autoritatiSecundare.length > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              + {t.autoritatiSecundare.join(", ")}
            </p>
          )}
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Temei legal
          </p>
          <p className="text-sm font-semibold flex items-center gap-1">
            <BookOpen size={12} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t.temeiLegal}
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Termen răspuns
          </p>
          <p className="text-sm font-semibold flex items-center gap-1">
            <Clock size={12} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t.termenRaspuns}
          </p>
        </div>
      </section>

      {/* Exemple */}
      {t.exemple.length > 0 && (
        <section aria-labelledby="exemple" className="mb-12">
          <h2
            id="exemple"
            className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4"
          >
            💡 Exemple concrete
          </h2>
          <ul className="space-y-2">
            {t.exemple.map((ex, i) => (
              <li
                key={i}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-sm flex items-start gap-2"
              >
                <span className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true">
                  →
                </span>
                {ex}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pași */}
      <section aria-labelledby="pasi" className="mb-12">
        <h2 id="pasi" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
          📋 Pași concreți
        </h2>
        <ol className="space-y-4">
          {t.pasi.map((step, i) => (
            <li
              key={step.titlu}
              className="howto-step bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 flex gap-4"
            >
              <span
                className="shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)] text-white grid place-items-center font-bold"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="howto-step-name font-semibold text-lg mb-1">{step.titlu}</h3>
                <p className="howto-step-text text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Send size={16} aria-hidden="true" />
            Fă o sesizare acum
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* FAQ specific tipului */}
      {t.faq.length > 0 && (
        <section aria-labelledby="faq" className="mb-12">
          <h2 id="faq" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
            🤔 Întrebări frecvente pentru {t.titlu.toLowerCase()}
          </h2>
          <div className="space-y-3">
            {t.faq.map((q) => (
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
      )}

      {/* Alert dacă autoritatea nu răspunde */}
      <section className="bg-amber-500/10 border-l-4 border-amber-500 rounded-[var(--radius-md)] p-5 mb-10 flex gap-3">
        <AlertCircle size={24} className="text-amber-500 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-bold mb-1">Dacă autoritatea nu răspunde în 30 zile</h2>
          <p className="text-sm leading-relaxed">
            Ai dreptul să escaladezi la <strong>Avocatul Poporului</strong>{" "}
            (gratuit) sau acțiune în <strong>contencios administrativ</strong>.{" "}
            <Link href="/avocatul-poporului-online" className="text-[var(--color-primary)] hover:underline font-medium">
              Vezi ghidul →
            </Link>
          </p>
        </div>
      </section>

      {/* Alte tipuri */}
      <section aria-labelledby="alte-tipuri" className="mb-12">
        <h2
          id="alte-tipuri"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4"
        >
          📚 Alte tipuri de sesizări
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {CUM_FAC_TIPURI.filter((x) => x.slug !== t.slug)
            .slice(0, 6)
            .map((other) => (
              <Link
                key={other.slug}
                href={`/cum-fac/${other.slug}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)] transition-colors flex items-center gap-2"
              >
                <span className="text-xl" aria-hidden="true">
                  {other.emoji}
                </span>
                <span className="text-sm font-semibold">{other.titlu}</span>
              </Link>
            ))}
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/cum-fac"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            Toate cele {CUM_FAC_TIPURI.length} tipuri →
          </Link>
        </div>
      </section>
    </div>
  );
}
