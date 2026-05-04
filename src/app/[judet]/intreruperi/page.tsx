import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calendar, ExternalLink } from "lucide-react";
import {
  getInterruptionsForCounty,
  TYPE_ICONS,
  TYPE_LABELS,
} from "@/data/intreruperi";
import { getCountyBySlug } from "@/data/counties";
import { SITE_URL } from "@/lib/constants";
import { IntreruperiFilters } from "../../intreruperi/IntreruperiFilters";
import {
  CountyPageHero,
  COUNTY_HERO_GRADIENT,
} from "@/components/county/CountyPageHero";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  return {
    title: `Întreruperi programate — ${county.name}`,
    description: `Întreruperi de apă, caldură, gaz, curent + lucrări la stradă în ${county.name}. Catalogat din anunțuri oficiale ale operatorilor locali.`,
    alternates: { canonical: `/${county.slug}/intreruperi` },
  };
}

export const revalidate = 1800;

export default async function JudetIntreruperiPage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) notFound();

  // Server component cu revalidate=1800 → Date.now() e calculat la
  // fiecare regenerare ISR, nu la fiecare request → comportament stabil.
  // eslint-disable-next-line react-hooks/purity -- ISR Server Component, fresh per regeneration
  const now = Date.now();
  const countyItems = await getInterruptionsForCounty(county.id);
  const all = countyItems.filter((i) => {
    // Strict > now (NU >=) — întreruperi care s-au terminat exact acum
    // nu mai apar ca active. Consistent cu getActiveInterruptions().
    return i.status !== "anulat" && i.status !== "finalizat" && new Date(i.endAt).getTime() > now;
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Întreruperi programate — ${county.name}`,
    description: `Catalog de întreruperi utilitare + lucrări de stradă pentru ${county.name}.`,
    url: `${SITE_URL}/${county.slug}/intreruperi`,
    spatialCoverage: { "@type": "AdministrativeArea", name: county.name },
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CountyPageHero
        countyName={county.name}
        countyId={county.id}
        countySlug={county.slug}
        title="Întreruperi programate"
        icon={AlertTriangle}
        gradient={COUNTY_HERO_GRADIENT.warning}
        description={
          <>
            Apă, caldură, gaz, curent + lucrări de stradă în <strong>{county.name}</strong>.
            Agregat din surse oficiale ale operatorilor locali. Filtrează după
            tip sau deschide harta.
          </>
        }
        tagline={
          all.length > 0
            ? `${all.length} ${all.length === 1 ? "întrerupere activă" : "întreruperi active"} · catalogul se reîmprospătează la fiecare 30 de minute.`
            : "Catalogul se reîmprospătează la fiecare 30 de minute."
        }
      />

      {/* Stat cards: pe mobile 2 cols (grid 2x2), pe md+ 4 cols. Cu
          padding redus pe mobile + label cu break-words ca să nu spargă
          „Electricitate" peste marginea card-ului pe ecrane înguste
          (360px iPhone SE). */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-8">
        {(["apa", "caldura", "gaz", "electricitate"] as const).map((t) => {
          const count = all.filter((i) => i.type === t).length;
          return (
            <div
              key={t}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 md:p-4 min-w-0"
            >
              <div className="text-xl md:text-2xl mb-1">{TYPE_ICONS[t]}</div>
              <div className="text-xl md:text-2xl font-bold text-[var(--color-primary)] font-[family-name:var(--font-sora)] tabular-nums">
                {count}
              </div>
              <div className="text-[10px] md:text-xs text-[var(--color-text-muted)] mt-0.5 leading-tight break-words">
                {TYPE_LABELS[t]}
              </div>
            </div>
          );
        })}
      </div>

      {all.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
          <Calendar
            size={40}
            className="mx-auto mb-3 text-[var(--color-text-muted)]"
          />
          <h2 className="font-semibold text-lg mb-1">
            Nicio întrerupere activă în {county.name}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Catalogul se actualizează la 6h. Revino curând sau urmărește sursele oficiale direct.
          </p>
          <Link
            href="/intreruperi"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline font-medium"
          >
            <ExternalLink size={14} /> Vezi toate întreruperile (toată țara)
          </Link>
        </div>
      ) : (
        <IntreruperiFilters items={all} />
      )}

      <section className="mt-12 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-[var(--radius-md)] p-6">
        <h2 className="font-semibold mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-300">
          <AlertTriangle size={16} /> Lipsește ceva?
        </h2>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Catalogul pentru {county.name} poate fi incomplet dacă nu avem
          încă un scraper pentru operatorul tău local. Folosește
          formularul „Știi o întrerupere?" de pe pagina națională să ne
          spui despre operatorul tău — îl adăugăm la următorul update.
        </p>
      </section>
    </div>
  );
}
