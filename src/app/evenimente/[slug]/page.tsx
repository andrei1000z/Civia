import type { Metadata } from "next";
import { ogTitle } from "@/lib/seo/share-meta";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Flame,
  Droplets,
  Zap,
  Users as UsersIcon,
  Building2,
  Car,
  AlertTriangle,
  MapPin,
  ExternalLink,
  ChevronLeft,
  TriangleAlert,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EvenimentMap } from "@/components/maps/EvenimentMap";
import { evenimente } from "@/data/evenimente";
import { evenimenteDetails } from "@/data/evenimente-detail";
import { formatDate } from "@/lib/utils";
import type { EvenimentCategory, EvenimentSeverity } from "@/types";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { HistoricalEventJsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-static";

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

export function generateStaticParams() {
  return evenimente.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const ev = evenimente.find((e) => e.slug === slug);
  const ogTtl = ev ? ogTitle(ev.titlu) : undefined;
  const ogDesc = ev?.descriere.slice(0, 160);
  const evImages = ev?.image ? [`/images/evenimente/${ev.image}.webp`] : ["/opengraph-image"];
  return {
    title: ev?.titlu ?? "Eveniment negăsit",
    description: ogDesc ?? "",
    alternates: { canonical: `/evenimente/${slug}` },
    openGraph: {
      title: ogTtl,
      description: ogDesc,
      type: "article",
      publishedTime: ev?.data,
      siteName: "Civia",
      locale: "ro_RO",
      images: evImages,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTtl,
      description: ogDesc,
      images: evImages,
    },
  };
}

export default async function EvenimentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const eveniment = evenimente.find((e) => e.slug === slug);
  const detail = evenimenteDetails[slug];
  if (!eveniment) notFound();

  const Icon = categoryIcons[eveniment.category];

  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: "Civia", url: SITE_URL },
        { name: "Evenimente", url: `${SITE_URL}/evenimente` },
        { name: eveniment.titlu, url: `${SITE_URL}/evenimente/${eveniment.slug}` },
      ]} />
      <HistoricalEventJsonLd
        name={eveniment.titlu}
        description={eveniment.descriere}
        startDate={eveniment.data}
        url={`${SITE_URL}/evenimente/${eveniment.slug}`}
        location={`Județul ${eveniment.county}, România`}
        image={
          eveniment.image
            ? `${SITE_URL}/images/evenimente/${eveniment.image}.webp`
            : undefined
        }
      />
      {/* Hero */}
      <section className={`relative bg-gradient-to-br ${eveniment.gradient} text-white overflow-hidden`}>
        {eveniment.image && (
          <>
            <Image
              src={`/images/evenimente/${eveniment.image}.webp`}
              alt=""
              fill
              sizes="100vw"
              priority
              className="absolute inset-0 object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        )}
        {!eveniment.image && <div className="absolute inset-0 bg-grid-pattern opacity-10" />}
        <div className="container-narrow relative z-10 py-12 md:py-16">
          <Link
            href="/evenimente"
            className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            <ChevronLeft size={16} aria-hidden="true" /> Toate evenimentele
          </Link>
          <div className="flex items-start gap-6">
            <div className="hidden md:flex w-20 h-20 rounded-[var(--radius-md)] bg-white/10 border border-white/20 items-center justify-center backdrop-blur" aria-hidden="true">
              <Icon size={44} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge className="bg-white/15 text-white border border-white/20">
                  {categoryLabels[eveniment.category]}
                </Badge>
                <Badge bgColor={severityColors[eveniment.severity]} color="white">
                  {severityLabels[eveniment.severity].toUpperCase()}
                </Badge>
                <Badge className="bg-white/15 text-white border border-white/20">
                  <time dateTime={eveniment.data}>{formatDate(eveniment.data)}</time>
                </Badge>
              </div>
              <h1 className="font-[family-name:var(--font-sora)] text-3xl md:text-5xl font-extrabold mb-3">
                {eveniment.titlu}
              </h1>
              <p className="text-lg text-white/85 max-w-2xl">{eveniment.descriere}</p>
            </div>
          </div>
        </div>
      </section>

      {detail?.ongoingStatus && (
        <div role="status" className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900">
          <div className="container-narrow py-3 flex items-center gap-3 text-sm">
            <TriangleAlert size={16} className="text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <span className="text-amber-900 dark:text-amber-200">
              <strong>Status:</strong> {detail.ongoingStatus}
            </span>
          </div>
        </div>
      )}

      <div className="container-narrow py-12 grid lg:grid-cols-[1fr_340px] gap-12">
        <article className="prose-civic max-w-none">
          {/* Stats */}
          {(eveniment.victime != null || eveniment.evacuati != null || eveniment.echipaje != null) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 not-prose">
              {eveniment.victime != null && eveniment.victime > 0 && (
                <StatCard icon={AlertTriangle} label="Victime" value={eveniment.victime.toString()} color="#DC2626" />
              )}
              {eveniment.evacuati != null && eveniment.evacuati > 0 && (
                <StatCard icon={UsersIcon} label="Evacuați" value={eveniment.evacuati.toString()} color="#F97316" />
              )}
              {eveniment.echipaje != null && eveniment.echipaje > 0 && (
                <StatCard icon={Building2} label="Echipaje" value={eveniment.echipaje.toString()} color="#2563EB" />
              )}
            </div>
          )}

          {detail ? (
            <>
              <h2>Ce s-a întâmplat</h2>
              <p>{detail.fullDescription}</p>

              <h2>Cronologie</h2>
              <div className="not-prose space-y-3 my-6">
                {detail.timeline.map((entry, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 w-20 text-right">
                      <span className="inline-block font-mono font-semibold text-[var(--color-primary)] text-sm">
                        {entry.time}
                      </span>
                    </div>
                    <div className="relative flex-1 pl-6 pb-3 border-l-2 border-[var(--color-border)] last:border-transparent">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-bg)]" />
                      <p className="font-semibold text-sm mb-0.5">{entry.titlu}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{entry.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h2>Localizare</h2>
              <div className="not-prose mb-8">
                <EvenimentMap
                  coords={detail.coords}
                  label={eveniment.titlu}
                  color={severityColors[eveniment.severity]}
                  zoom={15}
                  height="400px"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                  <MapPin size={12} aria-hidden="true" />
                  <span aria-label={`Coordonate ${detail.coords[0].toFixed(4)} latitudine, ${detail.coords[1].toFixed(4)} longitudine`}>
                    {detail.coords[0].toFixed(4)}, {detail.coords[1].toFixed(4)}
                  </span>
                </p>
              </div>

              <h2>Cauze identificate</h2>
              <ul>
                {detail.causes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>

              <h2>Impact</h2>
              <p>{detail.impact}</p>

              <h2>Răspunsul autorităților</h2>
              <p>{detail.response}</p>

              {detail.quotes.length > 0 && (
                <>
                  <h2>Declarații</h2>
                  <div className="not-prose my-6 space-y-3">
                    {detail.quotes.map((q, i) => (
                      <blockquote
                        key={i}
                        className="bg-[var(--color-surface)] border-l-4 border-[var(--color-primary)] rounded-r-[12px] p-4 not-italic"
                      >
                        <Quote size={16} className="text-[var(--color-primary)] mb-1" aria-hidden="true" />
                        <p className="text-sm italic mb-2">&ldquo;{q.text}&rdquo;</p>
                        <footer className="text-xs text-[var(--color-text-muted)] font-medium">
                          — {q.author}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </>
              )}

              <h2>Surse</h2>
              <ul className="not-prose space-y-2 text-sm">
                {detail.sources.map((src, i) => (
                  <li key={i} className="flex items-center gap-2 text-[var(--color-text-muted)]">
                    <ExternalLink size={14} aria-hidden="true" />
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                      aria-label={`${src.name} (deschide în tab nou)`}
                    >
                      {src.name}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2>Rezumat</h2>
              <p>{eveniment.descriere}</p>
              <div className="not-prose mt-6 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-text-muted)] mb-3">
                  <span aria-hidden="true">📝 </span>Detalii complete (cronologie, cauze, impact, surse) sunt în curs de documentare. Dacă ai informații verificabile despre acest eveniment, <Link href="/#footer-feedback" className="text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded">scrie-ne</Link>.
                </p>
                <Link
                  href="/evenimente"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                >
                  <span aria-hidden="true">←</span> Vezi toate evenimentele documentate
                </Link>
              </div>
            </>
          )}
        </article>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-3">
                Detalii
              </p>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[var(--color-text-muted)]">Data</dt>
                  <dd className="font-medium">
                    <time dateTime={eveniment.data}>{formatDate(eveniment.data)}</time>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-text-muted)]">Categorie</dt>
                  <dd className="font-medium">{categoryLabels[eveniment.category]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-text-muted)]">Gravitate</dt>
                  <dd>
                    <Badge bgColor={severityColors[eveniment.severity]} color="white">
                      {severityLabels[eveniment.severity]}
                    </Badge>
                  </dd>
                </div>
                {eveniment.victime != null && eveniment.victime > 0 && (
                  <div>
                    <dt className="text-xs text-[var(--color-text-muted)]">{eveniment.victime === 1 ? "Victimă" : "Victime"}</dt>
                    <dd className="font-medium text-red-600 tabular-nums">{eveniment.victime.toLocaleString("ro-RO")}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
      <Icon size={20} style={{ color }} className="mb-2" />
      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

