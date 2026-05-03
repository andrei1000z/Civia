import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Megaphone,
  Calendar,
  Clock,
  MapPin,
  Users,
  ExternalLink,
  Mail,
  Hash,
  Building2,
} from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { UpdateBody } from "@/app/updateuri/UpdateBody";
import { ALL_COUNTIES } from "@/data/counties";
import { SITE_URL } from "@/lib/constants";

export const revalidate = 600;

interface Protest {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cause: string | null;
  description: string;
  demands: string[];
  tags: string[];
  start_at: string;
  end_at: string | null;
  location_name: string;
  city: string | null;
  county_slug: string | null;
  lat: number | null;
  lng: number | null;
  organizer: string | null;
  organizer_url: string | null;
  contact_email: string | null;
  external_url: string | null;
  hashtag: string | null;
  cover_image_url: string | null;
  cover_image_credit: string | null;
  expected_attendance: number | null;
  status: "planificat" | "in_desfasurare" | "incheiat" | "anulat";
  featured: boolean;
  color_theme: string;
  visibility: "publica" | "draft";
}

const STATUS_META: Record<
  Protest["status"],
  { label: string; chip: string; dot: string }
> = {
  planificat: {
    label: "Programat",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    dot: "bg-emerald-500",
  },
  in_desfasurare: {
    label: "În desfășurare acum",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
    dot: "bg-rose-500 motion-safe:animate-pulse",
  },
  incheiat: {
    label: "Încheiat",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
    dot: "bg-slate-400",
  },
  anulat: {
    label: "Anulat",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
    dot: "bg-amber-500",
  },
};

const GRADIENT_BY_THEME: Record<string, string> = {
  warning: HERO_GRADIENT.warning,
  primary: HERO_GRADIENT.primary,
  petition: HERO_GRADIENT.petition,
  news: HERO_GRADIENT.news,
  success: HERO_GRADIENT.success,
  data: HERO_GRADIENT.data,
  authority: HERO_GRADIENT.authority,
  health: HERO_GRADIENT.health,
};

async function fetchProtest(slug: string): Promise<Protest | null> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("proteste")
      .select("*")
      .eq("slug", slug)
      .eq("visibility", "publica")
      .maybeSingle();
    return (data as Protest | null) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchProtest(slug);
  if (!p) return { title: "Protest" };
  const date = new Date(p.start_at).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
  const desc =
    p.subtitle ??
    p.cause ??
    `Protest la ${p.location_name} pe ${date}.`;
  const url = `${SITE_URL}/proteste/${p.slug}`;
  return {
    title: p.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: p.title,
      description: desc,
      url,
      images: p.cover_image_url ? [{ url: p.cover_image_url }] : ["/opengraph-image"],
      locale: "ro_RO",
    },
    twitter: {
      card: "summary_large_image",
      title: p.title,
      description: desc,
      images: p.cover_image_url ? [p.cover_image_url] : ["/opengraph-image"],
    },
  };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

function countyLabel(slug: string | null): string | null {
  if (!slug) return null;
  return ALL_COUNTIES.find((c) => c.slug === slug)?.name ?? null;
}

export default async function ProtestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await fetchProtest(slug);
  if (!p) notFound();

  const status = STATUS_META[p.status];
  const county = countyLabel(p.county_slug);
  const gradient = GRADIENT_BY_THEME[p.color_theme] ?? HERO_GRADIENT.warning;

  // JSON-LD: Event schema for Google rich results.
  const eventLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: p.title,
    startDate: p.start_at,
    ...(p.end_at ? { endDate: p.end_at } : {}),
    eventStatus:
      p.status === "anulat"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: p.location_name,
      address: [p.city, county, "România"].filter(Boolean).join(", "),
      ...(p.lat != null && p.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } }
        : {}),
    },
    ...(p.organizer
      ? {
          organizer: {
            "@type": "Organization",
            name: p.organizer,
            ...(p.organizer_url ? { url: p.organizer_url } : {}),
          },
        }
      : {}),
    ...(p.cover_image_url ? { image: [p.cover_image_url] } : {}),
    description: p.subtitle ?? p.cause ?? p.title,
  };

  const mapsHref =
    p.lat != null && p.lng != null
      ? `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`
      : `https://www.openstreetmap.org/search?query=${encodeURIComponent(
          [p.location_name, p.city, county].filter(Boolean).join(", "),
        )}`;

  return (
    <div className="container-narrow py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }}
      />

      <PageHero
        title={p.title}
        icon={Megaphone}
        gradient={gradient}
        backHref="/proteste"
        backLabel="Toate protestele"
        description={p.subtitle ? <>{p.subtitle}</> : undefined}
        tagline={p.cause ?? undefined}
      >
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-pill)] border text-xs font-semibold backdrop-blur-sm bg-white/15 ${status.chip}`}
          >
            <span className={`w-2 h-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.label}
          </span>
          {p.hashtag && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[var(--radius-pill)] bg-white/15 backdrop-blur-sm text-xs font-mono font-semibold">
              <Hash size={11} aria-hidden="true" />
              {p.hashtag.replace(/^#/, "")}
            </span>
          )}
          {p.featured && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-[var(--radius-pill)] bg-yellow-400/30 text-white border border-yellow-200/40 text-xs font-bold uppercase tracking-wider">
              Featured
            </span>
          )}
        </div>
      </PageHero>

      {/* Cover image — wide hero shot under the gradient. */}
      {p.cover_image_url && (
        <figure className="mb-8 -mt-2 rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-2)]">
          <div className="relative aspect-[16/8] bg-[var(--color-surface-2)]">
            <Image
              src={p.cover_image_url}
              alt={p.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          {p.cover_image_credit && (
            <figcaption className="px-4 py-2 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface)] border-t border-[var(--color-border)]">
              Foto: {p.cover_image_credit}
            </figcaption>
          )}
        </figure>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-6 md:gap-8">
        {/* MAIN COLUMN */}
        <div className="space-y-8 min-w-0">
          {/* Demands — surfaced at the top because they're the why. */}
          {p.demands.length > 0 && (
            <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-6">
              <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-base md:text-lg mb-4 inline-flex items-center gap-2">
                <span className="w-1 h-5 rounded bg-[var(--color-primary)]" aria-hidden="true" />
                Ce cer protestatarii
              </h2>
              <ol className="space-y-2.5">
                {p.demands.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm leading-relaxed text-[var(--color-text)]"
                  >
                    <span
                      className="shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] grid place-items-center font-mono text-[11px] font-bold mt-0.5"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Long-form description */}
          <section>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-base md:text-lg mb-4 inline-flex items-center gap-2">
              <span className="w-1 h-5 rounded bg-[var(--color-primary)]" aria-hidden="true" />
              Despre protest
            </h2>
            <UpdateBody markdown={p.description} />
          </section>

          {/* Tags */}
          {p.tags.length > 0 && (
            <section>
              <h2 className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
                Tag-uri
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <aside className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-md)] p-4 text-xs text-[var(--color-text)] leading-relaxed">
            <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">
              Civia nu organizează acest protest
            </p>
            <p className="text-[var(--color-text-muted)]">
              Pagina e un agregator de informații publice. Pentru detalii, contactează
              direct organizatorul. Participarea la protest e responsabilitatea fiecărui
              participant — respectă legea, păstrează atmosferă pașnică.
            </p>
          </aside>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 lg:sticky lg:top-20 space-y-3">
            <DetailRow icon={Calendar} label="Început">
              {formatDateTime(p.start_at)}
            </DetailRow>
            {p.end_at && (
              <DetailRow icon={Clock} label="Sfârșit estimat">
                {formatDateTime(p.end_at)}
              </DetailRow>
            )}
            <DetailRow icon={MapPin} label="Locație">
              <span className="block">{p.location_name}</span>
              {(p.city || county) && (
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {[p.city, county].filter(Boolean).join(", ")}
                </span>
              )}
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-[var(--color-primary)] hover:underline"
              >
                Deschide pe hartă <ExternalLink size={10} aria-hidden="true" />
              </a>
            </DetailRow>
            {p.expected_attendance != null && (
              <DetailRow icon={Users} label="Estimare participanți">
                ~{p.expected_attendance.toLocaleString("ro-RO")} persoane
              </DetailRow>
            )}
            {p.organizer && (
              <DetailRow icon={Building2} label="Organizator">
                {p.organizer_url ? (
                  <a
                    href={p.organizer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    {p.organizer} <ExternalLink size={10} aria-hidden="true" />
                  </a>
                ) : (
                  p.organizer
                )}
              </DetailRow>
            )}
            {p.contact_email && (
              <DetailRow icon={Mail} label="Contact">
                <a
                  href={`mailto:${p.contact_email}`}
                  className="text-[var(--color-primary)] hover:underline break-all"
                >
                  {p.contact_email}
                </a>
              </DetailRow>
            )}
          </div>

          {p.external_url && (
            <a
              href={p.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3 px-4 rounded-[var(--radius-button)] hover:bg-[var(--color-primary-hover)] transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              Eveniment oficial →
            </a>
          )}

          {p.status === "in_desfasurare" && p.start_at && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 text-center">
              Începe acum, la ora <strong>{formatTime(p.start_at)}</strong>
            </p>
          )}
        </aside>
      </div>

      <div className="mt-12 pt-6 border-t border-[var(--color-border)] text-center">
        <Link
          href="/proteste"
          className="text-sm text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
        >
          ← Toate protestele anunțate
        </Link>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="shrink-0 w-7 h-7 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] grid place-items-center mt-0.5"
        aria-hidden="true"
      >
        <Icon size={13} className="text-[var(--color-primary)]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-0.5">
          {label}
        </p>
        <div className="text-sm text-[var(--color-text)] leading-snug">{children}</div>
      </div>
    </div>
  );
}
