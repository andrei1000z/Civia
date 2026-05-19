import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Flame,
  Droplets,
  Zap,
  Users as UsersIcon,
  Building2,
  Car,
  ArrowRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { getCountyBySlug } from "@/data/counties";
import { evenimente } from "@/data/evenimente";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Eveniment, EvenimentCategory, EvenimentSeverity } from "@/types";
import {
  CountyPageHero,
  COUNTY_HERO_GRADIENT,
} from "@/components/county/CountyPageHero";

// 2026-05-19: ISR 1 zi. Evenimentele sunt static-content din /data/evenimente.
export const revalidate = 86400;

const categoryIcons: Record<EvenimentCategory, React.ElementType> = {
  accident: Car,
  incendiu: Flame,
  inundatie: Droplets,
  cutremur: Zap,
  protest: UsersIcon,
  infrastructura: Building2,
};

const categoryLabels: Record<EvenimentCategory, string> = {
  accident: "Accident",
  incendiu: "Incendiu",
  inundatie: "Inundații",
  cutremur: "Cutremur",
  protest: "Protest",
  infrastructura: "Infrastructură",
};

const severityColors: Record<EvenimentSeverity, string> = {
  minor: "#84CC16",
  moderat: "#EAB308",
  major: "#F97316",
  critic: "#DC2626",
};

const severityLabels: Record<EvenimentSeverity, string> = {
  minor: "Minor",
  moderat: "Moderat",
  major: "Major",
  critic: "Critic",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  return {
    title: `Evenimente — ${county.name}`,
    description: `Cronologia evenimentelor semnificative din ${county.name} și din România.`,
    alternates: { canonical: `/${county.slug}/evenimente` },
  };
}

function EventCard({ ev }: { ev: Eveniment }) {
  const Icon = categoryIcons[ev.category];
  return (
    <Link
      href={`/evenimente/${ev.slug}`}
      className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] transition-all"
    >
      <div className={`relative h-48 bg-gradient-to-br ${ev.gradient} overflow-hidden`}>
        {ev.image ? (
          <>
            <Image
              src={`/images/evenimente/${ev.image}.webp`}
              alt={ev.titlu}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
            <Icon size={72} strokeWidth={1.2} className="text-white/50 relative z-10" />
          </div>
        )}
        <div className="absolute top-3 left-3 z-10">
          <Badge bgColor="rgba(0,0,0,0.5)" color="white">
            {categoryLabels[ev.category]}
          </Badge>
        </div>
        <div className="absolute bottom-3 right-3 z-10">
          <Badge bgColor={severityColors[ev.severity]} color="white">
            {severityLabels[ev.severity]}
          </Badge>
        </div>
      </div>
      <div className="p-5">
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          {formatDate(ev.data)}
        </p>
        <h3 className="font-[family-name:var(--font-sora)] font-semibold text-lg mb-2 group-hover:text-[var(--color-primary)] transition-colors">
          {ev.titlu}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3">
          {ev.descriere}
        </p>
        {(ev.victime !== undefined || ev.evacuati !== undefined || ev.echipaje !== undefined) && (
          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)] pt-3 border-t border-[var(--color-border)]">
            {ev.victime !== undefined && ev.victime > 0 && (
              <span>{ev.victime} victime</span>
            )}
            {ev.evacuati !== undefined && ev.evacuati > 0 && (
              <span>{ev.evacuati} evacuați</span>
            )}
            {ev.echipaje !== undefined && ev.echipaje > 0 && (
              <span>{ev.echipaje} echipaje</span>
            )}
            <span className="ml-auto flex items-center gap-1 text-[var(--color-primary)] font-medium group-hover:gap-2 transition-all">
              Detalii <ArrowRight size={12} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default async function CountyEvenimentePage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return null;

  const localEvents = evenimente
    .filter((ev) => ev.county === county.id)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const nationalEvents = evenimente
    .filter((ev) => ev.county !== county.id)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="container-narrow py-8 md:py-12">
      <CountyPageHero
        countyName={county.name}
        countyId={county.id}
        countySlug={county.slug}
        title="Evenimente"
        icon={CalendarIcon}
        gradient={COUNTY_HERO_GRADIENT.events}
        description={
          <>
            Accidente, incendii, inundații, cutremure și proteste — arhivă
            documentată a incidentelor importante din <strong>{county.name}</strong> și
            din România.
          </>
        }
        tagline={
          localEvents.length > 0
            ? `${localEvents.length} ${localEvents.length === 1 ? "eveniment local" : "evenimente locale"} · ${nationalEvents.length} naționale.`
            : `${nationalEvents.length} evenimente naționale · arhiva locală pentru ${county.name} se completează manual.`
        }
      />

      {/* Local events */}
      {localEvents.length > 0 && (
        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-5">
            Evenimente în {county.name}
            <span className="ml-2 text-base font-normal text-[var(--color-text-muted)]">
              ({localEvents.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {localEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </section>
      )}

      {/* National events */}
      <section>
        <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mb-5">
          {localEvents.length > 0 ? "Evenimente naționale" : "Evenimente din România"}
          <span className="ml-2 text-base font-normal text-[var(--color-text-muted)]">
            ({nationalEvents.length})
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {nationalEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </div>
      </section>
    </div>
  );
}
