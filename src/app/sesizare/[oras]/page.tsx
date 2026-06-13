import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Send, MapPin, Building2, AlertCircle, ArrowRight, FileText } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { ORASE_MARI } from "@/data/orase-mari";
import { CUM_FAC_TIPURI } from "@/data/cum-fac-tipuri";
import { GovernmentServiceJsonLd, GovernmentOrganizationJsonLd } from "@/components/JsonLd";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export async function generateStaticParams() {
  return ORASE_MARI.map((o) => ({ oras: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ oras: string }>;
}): Promise<Metadata> {
  const { oras } = await params;
  const o = ORASE_MARI.find((x) => x.slug === oras);
  if (!o) return { title: "Pagină negăsită" };
  return {
    title: `Sesizare ${o.nume} — cum reclami la primăria din ${o.nume} | Civia`,
    description: `Trimite sesizare oficială la Primăria ${o.nume}: groapă, parcare, gunoi, iluminat, alte probleme. AI Civia formalizează emailul și îl trimite gratuit. Răspuns 30 zile (OG 27/2002).`,
    alternates: { canonical: `/sesizare/${o.slug}` },
    keywords: [
      `sesizare ${o.nume.toLowerCase()}`,
      `reclamatie primaria ${o.nume.toLowerCase()}`,
      `primaria ${o.nume.toLowerCase()}`,
      `${o.nume.toLowerCase()} probleme`,
      `cum reclam ${o.nume.toLowerCase()}`,
    ],
  };
}

export default async function SesizareOrasPage({
  params,
}: {
  params: Promise<{ oras: string }>;
}) {
  const { oras } = await params;
  const o = ORASE_MARI.find((x) => x.slug === oras);
  if (!o) notFound();

  const pageUrl = `${SITE_URL}/sesizare/${o.slug}`;
  const primariaName = `Primăria ${o.nume}`;

  const faq = [
    {
      question: `Cui îi trimit sesizarea în ${o.nume}?`,
      answer: `Sesizările civice ${o.nume} se trimit la ${primariaName}. Pentru probleme specifice: Poliția Locală (parcare), operator salubritate (gunoi), operator apă (canalizare). Civia detectează automat autoritatea corectă.`,
    },
    {
      question: `Cât durează răspunsul de la primăria ${o.nume}?`,
      answer: `30 zile calendaristice conform OG 27/2002 art. 8. Pentru cazuri complexe, prelungire de max 15 zile cu notificare prealabilă. Civia urmărește automat termenul.`,
    },
    {
      question: `Pot face sesizare în ${o.nume} fără să mă deplasez?`,
      answer: `Da. Civia.ro îți permite să trimiți sesizarea online — gratuit, în 90 secunde, cu fotografii. Emailul pleacă direct la ${primariaName} de la sesizari@civia.ro.`,
    },
    {
      question: `Ce probleme se raportează cel mai des în ${o.nume}?`,
      answer: `În ${o.nume}: ${o.probleme.join(", ")}. Vezi /statistici-sesizari-romania pentru date live.`,
    },
    {
      question: `Dacă primăria ${o.nume} nu răspunde, ce fac?`,
      answer: `1) Revenire formală. 2) Plângere la Avocatul Poporului (gratuit, avp.ro). 3) Contencios administrativ (Tribunal). Civia generează template pentru toate trei.`,
    },
  ];

  return (
    <div className="container-narrow py-8 md:py-12 max-w-4xl">
      <GovernmentServiceJsonLd
        code={`oras-${o.slug}`}
        titlu={`Sesizare civică ${o.nume}`}
        tip="sesizare civică"
        locatie={o.nume}
        descriere={`Serviciu civic pentru cetățenii din ${o.nume}: trimitere sesizare oficială către ${primariaName} via Civia.ro, conform OG 27/2002.`}
        url={pageUrl}
        providerName={primariaName}
        createdAt={new Date().toISOString()}
        status="activ"
      />
      <GovernmentOrganizationJsonLd
        name={primariaName}
        description={`Primăria municipiului ${o.nume}, județul ${o.judetNume}. Populație: ${o.populatie.toLocaleString("ro-RO")}.`}
        url={o.primariaSite ? `https://${o.primariaSite}` : pageUrl}
        areaServed={o.nume}
      />
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Sesizare per oraș", url: `${SITE_URL}/sesizare` },
          { name: o.nume, url: pageUrl },
        ]}
      />

      <PageHero
        title={`Sesizare ${o.nume}`}
        icon={MapPin}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Trimite sesizare oficială la <strong>{primariaName}</strong> —
            gratuit, în 90 secunde. AI Civia formalizează emailul și îl trimite
            direct. Termen legal de răspuns: <strong>30 de zile</strong> (OG 27/2002).
          </>
        }
        tagline={`${o.judetNume} · Populație ${o.populatie.toLocaleString("ro-RO")} · Conform OG 27/2002`}
      />

      {/* Quick stats */}
      <section className="grid sm:grid-cols-3 gap-4 mb-12">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <Building2 size={20} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Primăria
          </p>
          <p className="text-sm font-bold">{primariaName}</p>
          {o.primariaSite && (
            <a
              href={`https://${o.primariaSite}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {o.primariaSite} ↗
            </a>
          )}
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <MapPin size={20} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Județ
          </p>
          <p className="text-sm font-bold">
            <Link href={`/${o.judetSlug}`} className="hover:text-[var(--color-primary)]">
              {o.judetNume}
            </Link>
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <FileText size={20} className="text-[var(--color-primary)] mb-2" aria-hidden="true" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Populație
          </p>
          <p className="text-sm font-bold">{o.populatie.toLocaleString("ro-RO")}</p>
        </div>
      </section>

      {/* Probleme tipice */}
      <section aria-labelledby="probleme" className="mb-12">
        <h2 id="probleme" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          🏙️ Probleme tipice în {o.nume}
        </h2>
        <div className="flex flex-wrap gap-2">
          {o.probleme.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Operatori publici locali */}
      {o.operatori && o.operatori.length > 0 && (
        <section aria-labelledby="operatori" className="mb-12">
          <h2 id="operatori" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
            🏛️ Operatori publici {o.nume}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {o.operatori.map((op) => (
              <div
                key={op.domeniu}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4"
              >
                <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-primary)] mb-1">
                  {op.domeniu}
                </p>
                <p className="text-sm font-semibold">{op.nume}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA principal */}
      <section className="text-center bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-2 border-emerald-500/30 rounded-[var(--radius-md)] p-8 mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Trimite sesizare la {primariaName}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
          Civia detectează autoritatea corectă din {o.nume}, formalizează emailul
          și îl trimite. 90 secunde. Gratuit.
        </p>
        <Link
          href="/sesizari"
          className="inline-flex items-center gap-2 h-14 px-8 rounded-[var(--radius-button)] bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-lg font-bold hover:brightness-110 shadow-[var(--shadow-3)] transition-all"
        >
          <Send size={18} aria-hidden="true" />
          Fă o sesizare în {o.nume}
        </Link>
      </section>

      {/* Tipuri sesizări (link la /cum-fac) */}
      <section aria-labelledby="tipuri" className="mb-12">
        <h2 id="tipuri" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          📋 Ghiduri pentru tipuri specifice
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {CUM_FAC_TIPURI.slice(0, 6).map((t) => (
            <Link
              key={t.slug}
              href={`/cum-fac/${t.slug}`}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)] transition-colors flex items-center gap-2"
            >
              <span className="text-xl" aria-hidden="true">
                {t.emoji}
              </span>
              <span className="text-sm font-semibold">{t.titlu}</span>
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

      {/* FAQ */}
      <section aria-labelledby="faq" className="mb-12">
        <h2 id="faq" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
          🤔 Întrebări despre sesizările din {o.nume}
        </h2>
        <div className="space-y-3">
          {faq.map((q) => (
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
              <div className="px-4 pb-4 pt-1 text-sm leading-relaxed">{q.answer}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Escaladare dacă nu răspunde */}
      <section className="bg-amber-500/10 border-l-4 border-amber-500 rounded-[var(--radius-md)] p-5 mb-12 flex gap-3">
        <AlertCircle size={24} className="text-amber-500 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-bold mb-1">Dacă {primariaName} nu răspunde în 30 zile</h2>
          <p className="text-sm leading-relaxed">
            Ai dreptul să escaladezi la <strong>Avocatul Poporului</strong>{" "}
            (gratuit, public).{" "}
            <Link
              href="/avocatul-poporului-online"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              Vezi ghidul →
            </Link>
          </p>
        </div>
      </section>

      {/* Alte orașe */}
      <section aria-labelledby="alte-orase" className="mb-12">
        <h2
          id="alte-orase"
          className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4"
        >
          📍 Alte orașe acoperite
        </h2>
        <div className="flex flex-wrap gap-2">
          {ORASE_MARI.filter((x) => x.slug !== o.slug)
            .slice(0, 12)
            .map((other) => (
              <Link
                key={other.slug}
                href={`/sesizare/${other.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                {other.nume}
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
