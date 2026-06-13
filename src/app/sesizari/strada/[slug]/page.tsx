import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Send, ArrowRight, AlertCircle } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { STRAZI_POPULARE } from "@/data/strazi-populare";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/FaqJsonLd";
import { ItemListJsonLd } from "@/components/JsonLd";

export const revalidate = 14400; // 4h

export async function generateStaticParams() {
  return STRAZI_POPULARE.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const strada = STRAZI_POPULARE.find((s) => s.slug === slug);
  if (!strada) return { title: "Pagină negăsită" };
  return {
    title: `Sesizări pe ${strada.nume} — probleme civice raportate | Civia`,
    description: strada.descriere,
    alternates: { canonical: `/sesizari/strada/${strada.slug}` },
    keywords: [
      `sesizare ${strada.nume.toLowerCase()}`,
      `probleme ${strada.nume.toLowerCase()}`,
      `parcare ${strada.nume.toLowerCase()}`,
      ...(strada.aliases ?? []).map((a) => `sesizare ${a.toLowerCase()}`),
    ],
  };
}

interface SesizareMatch {
  id: string;
  code: string;
  titlu: string;
  locatie: string;
  sector: string | null;
  tip: string;
  status: string;
  created_at: string;
}

async function findSesizariOnStreet(strada: typeof STRAZI_POPULARE[number]): Promise<SesizareMatch[]> {
  try {
    const admin = createSupabaseAdmin();
    // Build OR filter pe nume + aliases pentru locatie ILIKE
    const allTerms = [strada.nume, ...(strada.aliases ?? [])];
    // Use the strongest unique substring (skip „Strada"/„Bulevardul" prefix)
    const filters = allTerms
      .map((t) => t.replace(/^(Strada|Bulevardul|Calea|Șoseaua|Soseaua|Bd|Sos)\s+/i, "").trim())
      .filter((t) => t.length >= 4)
      .map((t) => `locatie.ilike.%${t}%`)
      .join(",");
    const { data } = await admin
      .from("sesizari")
      .select("id, code, titlu, locatie, sector, tip, status, created_at")
      .eq("publica", true)
      .eq("moderation_status", "approved")
      .or(filters)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data as SesizareMatch[] | null) ?? [];
  } catch {
    return [];
  }
}

export default async function SesizareStradaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const strada = STRAZI_POPULARE.find((s) => s.slug === slug);
  if (!strada) notFound();

  const sesizari = await findSesizariOnStreet(strada);
  const pageUrl = `${SITE_URL}/sesizari/strada/${strada.slug}`;

  const faq = [
    {
      question: `Câte sesizări sunt raportate pe ${strada.nume}?`,
      answer: `${sesizari.length} sesizări active sau rezolvate. Această listă se actualizează la 4 ore pe baza datelor publice Civia.`,
    },
    {
      question: `Cum trimit o sesizare pentru o problemă pe ${strada.nume}?`,
      answer: `Apasă „Trimite o sesizare" → completezi în 90 secunde → AI Civia trimite emailul oficial la primărie + Poliție Locală. Gratuit, conform OG 27/2002.`,
    },
    {
      question: `Cine răspunde pentru problemele pe ${strada.nume}?`,
      answer: strada.sector
        ? `Pentru ${strada.nume}, sectorul ${strada.sector.replace("S", "")}: Primăria Sector ${strada.sector.replace("S", "")} + Poliția Locală Sector ${strada.sector.replace("S", "")} + Primăria Generală București (pentru bulevarde principale).`
        : `Primăria locală competentă pentru ${strada.nume}. Civia detectează automat din locație.`,
    },
  ];

  return (
    <div className="container-narrow py-8 md:py-12 max-w-5xl">
      <ItemListJsonLd
        name={`Sesizări pe ${strada.nume}`}
        description={strada.descriere}
        url={pageUrl}
        items={sesizari.slice(0, 20).map((s, i) => ({
          name: s.titlu,
          url: `/sesizari/${s.code}`,
          position: i + 1,
        }))}
      />
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Sesizări publice", url: `${SITE_URL}/sesizari-publice` },
          { name: strada.nume, url: pageUrl },
        ]}
      />

      <PageHero
        title={`Sesizări pe ${strada.nume}`}
        icon={MapPin}
        gradient={HERO_GRADIENT.primary}
        backHref="/sesizari-publice"
        backLabel="Toate sesizările publice"
        description={
          <>
            <strong>{sesizari.length}</strong> {sesizari.length === 1 ? "sesizare" : "sesizări"} active sau rezolvate pe{" "}
            <strong>{strada.nume}</strong>
            {strada.sector ? `, Sector ${strada.sector.replace("S", "")}, București` : ""}.
          </>
        }
        tagline={`${strada.descriere} · Conform OG 27/2002 · Termen legal de răspuns 30 de zile (OG 27/2002)`}
      />

      {/* Stats + CTA */}
      <section className="grid sm:grid-cols-2 gap-4 mb-12">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
            Total sesizări
          </p>
          <p className="text-3xl font-bold font-[family-name:var(--font-sora)]">
            {sesizari.length}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            din {strada.nume}, indexate pe Civia
          </p>
        </div>
        <Link
          href="/sesizari"
          className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-2 border-emerald-500/30 rounded-[var(--radius-md)] p-5 hover:border-emerald-500 transition-colors group"
        >
          <Send size={24} className="text-emerald-500 mb-2" aria-hidden="true" />
          <p className="font-bold text-base group-hover:text-emerald-500 transition-colors">
            Vrei să raportezi tu?
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Trimite sesizare în 90 sec
            <ArrowRight size={12} className="inline ml-1" aria-hidden="true" />
          </p>
        </Link>
      </section>

      {/* Sesizări lista */}
      {sesizari.length > 0 ? (
        <section aria-labelledby="lista" className="mb-12">
          <h2 id="lista" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
            📍 Probleme raportate pe {strada.nume}
          </h2>
          <div className="space-y-3">
            {sesizari.slice(0, 20).map((s) => (
              <Link
                key={s.id}
                href={`/sesizari/${s.code}`}
                className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-2)] transition-all"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <h3 className="font-semibold text-base flex-1 min-w-0">{s.titlu}</h3>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{s.locatie}</p>
              </Link>
            ))}
          </div>
          {sesizari.length > 20 && (
            <p className="text-xs text-[var(--color-text-muted)] text-center mt-4">
              + {sesizari.length - 20} alte sesizări vizibile pe{" "}
              <Link href="/sesizari-publice" className="text-[var(--color-primary)] hover:underline">
                pagina principală
              </Link>
            </p>
          )}
        </section>
      ) : (
        <section className="bg-amber-500/10 border-l-4 border-amber-500 rounded-[var(--radius-md)] p-5 mb-12 flex gap-3">
          <AlertCircle size={24} className="text-amber-500 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-bold mb-1">Nicio sesizare încă pe {strada.nume}</h2>
            <p className="text-sm leading-relaxed">
              Ești primul care raportează o problemă pe {strada.nume}? Civia te ajută să trimiți
              sesizarea oficială în 90 secunde, gratuit.{" "}
              <Link href="/sesizari" className="text-[var(--color-primary)] hover:underline font-medium">
                Trimite o sesizare acum →
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section aria-labelledby="faq" className="mb-12">
        <h2 id="faq" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6">
          🤔 Întrebări despre sesizările pe {strada.nume}
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

      {/* Other streets */}
      <section aria-labelledby="alte" className="mb-12">
        <h2 id="alte" className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          📍 Alte străzi cu sesizări active
        </h2>
        <div className="flex flex-wrap gap-2">
          {STRAZI_POPULARE.filter((s) => s.slug !== strada.slug)
            .slice(0, 12)
            .map((other) => (
              <Link
                key={other.slug}
                href={`/sesizari/strada/${other.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                {other.nume}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
