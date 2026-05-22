import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Send } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { ORASE_MARI } from "@/data/orase-mari";
import { ItemListJsonLd } from "@/components/JsonLd";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export const metadata: Metadata = {
  title: `Sesizare per oraș — 30 orașe din România | Civia`,
  description: `Sesizare online către primării ${ORASE_MARI.length}+ orașe din România: București, Cluj, Timișoara, Iași, Constanța și altele. Civia formalizează emailul gratuit.`,
  alternates: { canonical: "/sesizare" },
  keywords: [
    "sesizare oras",
    "reclamatie primarii romania",
    "primarii principale",
    "sesizare bucuresti",
    "sesizare cluj",
    "sesizare timisoara",
  ],
};

export default function SesizareIndexPage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-5xl">
      <ItemListJsonLd
        name="Sesizări — toate orașele acoperite"
        description={`Pagini dedicate pentru ${ORASE_MARI.length} orașe românești, cu primăria, operatorii publici și ghiduri specifice.`}
        url={`${SITE_URL}/sesizare`}
        items={ORASE_MARI.map((o, i) => ({
          name: `Sesizare ${o.nume}`,
          url: `/sesizare/${o.slug}`,
          position: i + 1,
        }))}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Sesizare per oraș", url: `${SITE_URL}/sesizare` },
        ]}
      />

      <PageHero
        title="Sesizare per oraș"
        icon={MapPin}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            <strong>{ORASE_MARI.length} orașe</strong> acoperite — fiecare cu
            pagină dedicată: primăria, operatori publici, probleme tipice,
            ghiduri.
          </>
        }
        tagline="Sortate după populație · Acoperire România întreagă (42 județe)"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {ORASE_MARI.map((o) => (
          <Link
            key={o.slug}
            href={`/sesizare/${o.slug}`}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-2)] transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold group-hover:text-[var(--color-primary)] transition-colors">
                {o.nume}
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                {o.judetNume}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              Populație: {o.populatie.toLocaleString("ro-RO")}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Probleme tipice: {o.probleme.slice(0, 3).join(", ")}
            </p>
          </Link>
        ))}
      </div>

      <section className="text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Nu găsești orașul tău?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
          Civia acoperă 220+ orașe + 42 județe. AI detectează automat primăria
          din locație, indiferent unde te afli.
        </p>
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
