import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Clock, ArrowRight } from "lucide-react";
import { getCountyBySlug } from "@/data/counties";
import { ghiduri } from "@/data/ghiduri";
import { Badge } from "@/components/ui/Badge";
import { CountyPageHero } from "@/components/county/CountyPageHero";

// 2026-05-19: ISR 1 saptamana. Ghidurile sunt static-content (data din /data).
export const revalidate = 604800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  return {
    title: "Ghiduri pentru cetățeni",
    description: `Ghiduri complete pentru cetățeni în ${county.name}: bicicletă, caniculă, cutremur, transport, sesizări.`,
    alternates: { canonical: `/${county.slug}/ghiduri` },
  };
}

const dificultateMap = {
  usor: { label: "Ușor", variant: "success" as const },
  mediu: { label: "Mediu", variant: "warning" as const },
  avansat: { label: "Avansat", variant: "accent" as const },
};

export default async function GhiduriPage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) notFound();

  return (
    <div className="container-narrow py-8 md:py-12">
      <CountyPageHero
        countyName={county.name}
        countyId={county.id}
        countySlug={county.slug}
        title="Ghiduri pentru cetățeni"
        icon={BookOpen}
        // Purple flavor — kept the original mood of the page, just
        // pulled into the same hero shape used by the rest of the
        // /[judet] surfaces.
        gradient="from-purple-600 via-fuchsia-700 to-pink-800"
        description={
          <>
            Informații clare, structurate și verificate pentru a naviga mai
            ușor prin <strong>{county.name}</strong> — de la bicicletă la
            cutremur.
          </>
        }
        tagline={`${ghiduri.length} ghiduri publicate · informația ajunge la tine în 5–15 min de citit.`}
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ghiduri.map((ghid) => (
              <Link
                key={ghid.id}
                href={`/ghiduri/${ghid.slug}`}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] transition-all"
              >
                <div className={`relative h-48 bg-gradient-to-br ${ghid.gradient} overflow-hidden`}>
                  {ghid.image && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/images/ghiduri/${ghid.image}.webp`}
                        alt={ghid.titlu}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    </>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-7xl relative z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-300">
                      {ghid.icon}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={dificultateMap[ghid.dificultate].variant}>
                      {dificultateMap[ghid.dificultate].label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Clock size={12} />
                      {ghid.timpCitire} min
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-sora)] font-semibold text-xl mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                    {ghid.titlu}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-3">
                    {ghid.descriere}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <BookOpen size={14} />
                      {ghid.capitole} capitole
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] group-hover:gap-2 transition-all">
                      Citește
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}
