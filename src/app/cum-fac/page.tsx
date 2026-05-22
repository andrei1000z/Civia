import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Send } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";
import { CUM_FAC_TIPURI } from "@/data/cum-fac-tipuri";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { ItemListJsonLd } from "@/components/JsonLd";

export const revalidate = 604800; // 7 days — literal pt Next 16

export const metadata: Metadata = {
  title: `Cum fac sesizare — ${CUM_FAC_TIPURI.length} ghiduri concrete | Civia`,
  description: `Ghid complet pentru ${CUM_FAC_TIPURI.length} tipuri de probleme civice: groapă, parcare, gunoi, iluminat, stâlpișori, trotuar, apă, transport, etc. Cu autoritate competentă + temei legal + pași.`,
  alternates: { canonical: "/cum-fac" },
  keywords: [
    "cum fac sesizare",
    "ghid sesizari romania",
    "tipuri probleme civice",
    "cui ma adresez primaria",
  ],
};

export default function CumFacIndex() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-5xl">
      <ItemListJsonLd
        name="Ghiduri sesizări civice — toate tipurile"
        description={`${CUM_FAC_TIPURI.length} ghiduri concrete pentru raportarea problemelor civice către autoritățile responsabile.`}
        url={`${SITE_URL}/cum-fac`}
        items={CUM_FAC_TIPURI.map((t, i) => ({
          name: `Cum fac sesizare pentru ${t.titlu.toLowerCase()}`,
          url: `/cum-fac/${t.slug}`,
          position: i + 1,
        }))}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Cum fac sesizare", url: `${SITE_URL}/cum-fac` },
        ]}
      />

      <PageHero
        title="Cum fac sesizare — ghiduri concrete"
        icon={BookOpen}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            <strong>{CUM_FAC_TIPURI.length} ghiduri</strong> pentru cele mai
            comune probleme civice românești. Fiecare cu autoritate competentă,
            temei legal, pași concreți.
          </>
        }
        tagline="Cu Civia trimiți sesizarea în 90 secunde, gratuit, conform OG 27/2002."
      />

      {/* Grid tipuri */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {CUM_FAC_TIPURI.map((t) => (
          <Link
            key={t.slug}
            href={`/cum-fac/${t.slug}`}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-2)] transition-all group"
          >
            <div className="text-3xl mb-3" aria-hidden="true">
              {t.emoji}
            </div>
            <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-2 group-hover:text-[var(--color-primary)] transition-colors">
              {t.titlu}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3">
              {t.scurt}
            </p>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-primary)]">
              Autoritate: {t.autoritate.split("(")[0]?.trim() ?? t.autoritate}
            </p>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <section className="text-center bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-3">
          Sau direct — Civia detectează automat
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
          Fotografiază problema. AI-ul Civia detectează tipul + autoritatea
          competentă din toate cele {CUM_FAC_TIPURI.length} categorii.
        </p>
        <Link
          href="/sesizari"
          className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Send size={16} aria-hidden="true" />
          Fă o sesizare în 90 secunde
        </Link>
      </section>
    </div>
  );
}
