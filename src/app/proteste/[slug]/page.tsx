import type { Metadata } from "next";
import { ogTitle, ogDescription } from "@/lib/seo/share-meta";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { safeJsonLd } from "@/components/JsonLd";
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
  Quote,
  MessageSquare,
  ListChecks,
  Newspaper,
} from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { MarkdownBody } from "@/components/markdown/MarkdownBody";
import { ALL_COUNTIES } from "@/data/counties";
import { SITE_URL } from "@/lib/constants";
import { AftermathGallery } from "@/components/proteste/AftermathGallery";
import { AftermathVideos } from "@/components/proteste/AftermathVideos";
import { ShareProtestButton } from "@/components/proteste/ShareProtestButton";
import { EvenimentMap } from "@/components/maps/EvenimentMap";
import type {
  AftermathImage,
  AftermathVideo,
  AftermathSource,
} from "@/lib/proteste/aftermath";

// 2026-05-19: 30min → 6h. Detalii protest static dupa creare.
export const revalidate = 21600;

// 2026-05-24 PERF: prerendered all proteste publice la build → instant TTFB.
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("proteste")
      .select("slug")
      .eq("visibility", "publica")
      .limit(50);
    return (data ?? []).map((p) => ({ slug: (p as { slug: string }).slug }));
  } catch {
    return [];
  }
}

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
  // Aftermath fields (migration 034) — optional, only populated after a
  // moderator approves a submitted aftermath.
  aftermath_attendance_estimate: number | null;
  aftermath_narrative: string | null;
  aftermath_chants: string[] | null;
  aftermath_messages: string[] | null;
  aftermath_key_moments: string[] | null;
  aftermath_outcome: string | null;
  aftermath_images: AftermathImage[] | null;
  aftermath_videos: AftermathVideo[] | null;
  aftermath_sources: AftermathSource[] | null;
  aftermath_moderation_status: "none" | "pending" | "approved" | "rejected";
  aftermath_published_at: string | null;
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

/**
 * Derived live status. DB-ul ține `status` static (setat admin la creare),
 * dar pentru afișaj public vrem ca după ce trece data + durata estimată,
 * protestul să apară automat „Încheiat" — fără să cerem admin-ului să
 * marcheze manual fiecare. Excepție: dacă admin-ul a marcat „anulat",
 * păstrăm acea decizie indiferent de timp.
 */
function deriveStatus(p: Protest): Protest["status"] {
  if (p.status === "anulat") return "anulat";
  const now = Date.now();
  const start = new Date(p.start_at).getTime();
  // Default 4h durată dacă end_at lipsește (proteste tipice 2-4h).
  const end = p.end_at ? new Date(p.end_at).getTime() : start + 4 * 60 * 60 * 1000;
  if (now < start) return "planificat";
  if (now <= end) return "in_desfasurare";
  return "incheiat";
}

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
  const desc = ogDescription(
    p.subtitle ?? p.cause ?? `Protest la ${p.location_name} pe ${date}.`,
  );
  const ogTtl = ogTitle(p.title);
  const url = `${SITE_URL}/proteste/${p.slug}`;
  return {
    title: p.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: ogTtl,
      description: desc,
      siteName: "Civia",
      url,
      // 2026-06-07 (audit #38) — fallback la OG-ul PER-PROTEST (titlu + dată +
      // locație + status), nu la cel root generic. Activează opengraph-image.tsx.
      images: p.cover_image_url ? [{ url: p.cover_image_url }] : [`${url}/opengraph-image`],
      locale: "ro_RO",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTtl,
      description: desc,
      images: p.cover_image_url ? [p.cover_image_url] : [`${url}/opengraph-image`],
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

  // Derived status — DB-ul ține `status` static (setat manual de admin).
  // Pe pagina publică derivăm din timp: dacă protestul e în trecut și
  // nu e marcat „anulat", afișăm „Încheiat" indiferent ce zice DB-ul.
  // Asta evită bug-ul „protest de ieri afișat ca «Programat»".
  const derivedStatus = deriveStatus(p);
  const status = STATUS_META[derivedStatus];
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
      derivedStatus === "anulat"
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

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Acasă", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Proteste", item: `${SITE_URL}/proteste` },
      { "@type": "ListItem", position: 3, name: p.title, item: `${SITE_URL}/proteste/${p.slug}` },
    ],
  };

  return (
    <div className="lc-canvas lc-canvas--flat flex-1">
    <div className="container-narrow py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(eventLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
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
          {/* 2026-05-25 — Share button native pe hero (mobile + desktop) */}
          <ShareProtestButton
            url={`${SITE_URL}/proteste/${p.slug}`}
            title={p.title}
            text={p.cause ?? p.subtitle ?? undefined}
            size="sm"
          />
        </div>
      </PageHero>

      {/* Cover image — wide hero shot under the gradient. */}
      {p.cover_image_url && (
        <figure className="mb-8 -mt-2 rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-2)]">
          <div className="relative aspect-[16/8] bg-[var(--color-surface-2)]">
            <Image
              src={p.cover_image_url}
              unoptimized
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
            <section className="lc-glass-2 rounded-3xl p-5 md:p-6">
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
            <MarkdownBody markdown={p.description} />
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
                    className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-[10px] uppercase tracking-wider font-semibold"
                  >
                    {t.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* AFTERMATH — vizibil DOAR dacă aftermath e approved. Edit din
              /admin/proteste, nu de aici. */}
          <AftermathSection protest={p} />

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
          {/* 2026-05-25 — Map widget NOU. Reutilizează EvenimentMap component
              (single pin marker pe coordonate). Hide dacă lat/lng lipsesc.
              Click pe „Deschide pe hartă" rămâne în DetailRow pentru
              Google Maps / OSM full view. */}
          {p.lat != null && p.lng != null && (
            <div className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)] shadow-[var(--shadow-1)]">
              <EvenimentMap
                coords={[p.lat, p.lng]}
                label={p.location_name}
                color={status.dot.includes("rose") ? "#f43f5e" : "#f59e0b"}
                zoom={15}
                height="220px"
              />
            </div>
          )}

          <div className="lc-glass-2 rounded-3xl p-4 lg:sticky lg:top-20 space-y-3">
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
              className="lc-liquid lc-magnetic block w-full text-center bg-[var(--color-primary)] text-white font-semibold py-3 px-4 rounded-[var(--radius-full)] hover:bg-[var(--color-primary-hover)] transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              Eveniment oficial →
            </a>
          )}

          {derivedStatus === "in_desfasurare" && p.start_at && (
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

      {/* 2026-05-25 — Sticky bottom action bar mobile.
          2 acțiuni: distribuie + (link eveniment oficial dacă există).
          Hide pe desktop + dacă protest e cancelled/finalizat. */}
      {p.status !== "incheiat" && (
        <div
          // 2026-06-14 — deasupra barei BottomNav (mobil): offset = înălțimea
          // barei (~4.4rem) + gap, safe-area inclusă.
          className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] left-0 right-0 z-40 bg-[var(--color-bg)]/95 backdrop-blur border-t border-[var(--color-border)]"
        >
          <div className="container-narrow py-3 px-3 flex gap-2">
            <ShareProtestButton
              url={`${SITE_URL}/proteste/${p.slug}`}
              title={p.title}
              text={p.cause ?? p.subtitle ?? undefined}
              variant="pill"
              size="md"
            />
            {p.external_url && (
              <a
                href={p.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-full)] bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all shadow-[0_8px_24px_-4px_rgba(245,158,11,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>Eveniment oficial</span>
              </a>
            )}
          </div>
        </div>
      )}
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

// ============================================================
// Aftermath section — "Cum a fost"
// Public-facing: render NUMAI dacă aftermath e approved. Zero CTA
// peste tot (feature 100% mutat în /admin/proteste).
// ============================================================
function AftermathSection({ protest }: { protest: Protest }) {
  const isPast = new Date(protest.start_at) < new Date();
  if (!isPast) return null;
  if (protest.aftermath_moderation_status !== "approved") return null;

  // Approved aftermath — render full
  const images = protest.aftermath_images ?? [];
  const videos = protest.aftermath_videos ?? [];
  const sources = protest.aftermath_sources ?? [];
  const chants = protest.aftermath_chants ?? [];
  const messages = protest.aftermath_messages ?? [];
  const moments = protest.aftermath_key_moments ?? [];

  return (
    <section className="rounded-[var(--radius-lg)] border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-5 md:p-6 space-y-6">
      <header className="flex items-start gap-3 pb-3 border-b border-[var(--color-border)]">
        <span
          className="shrink-0 w-10 h-10 rounded-[var(--radius-xs)] bg-emerald-500/15 grid place-items-center"
          aria-hidden="true"
        >
          <Megaphone size={18} className="text-emerald-600 dark:text-emerald-400" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-lg md:text-xl">
            Cum a fost
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Documentat după ce protestul a avut loc, pe baza{" "}
            {sources.length > 0
              ? `${sources.length} ${sources.length === 1 ? "sursă de presă" : "surse de presă"}`
              : "observațiilor participanților"}
            .
          </p>
        </div>
        {protest.aftermath_attendance_estimate != null && (
          <div className="shrink-0 text-right">
            <p className="text-2xl md:text-3xl font-[family-name:var(--font-sora)] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
              ~{protest.aftermath_attendance_estimate.toLocaleString("ro-RO")}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1">
              participanți
            </p>
          </div>
        )}
      </header>

      {/* Narrative — secțiune principală despre cum a decurs protestul */}
      {protest.aftermath_narrative && (
        <div>
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Cum a decurs
          </h3>
          <MarkdownBody markdown={protest.aftermath_narrative} />
        </div>
      )}

      {/* Key moments — cronologie */}
      {moments.length > 0 && (
        <div>
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
            <ListChecks size={14} aria-hidden="true" />
            Momente cheie
          </h3>
          <ol className="space-y-2 border-l-2 border-emerald-500/40 pl-4">
            {moments.map((m, i) => (
              <li key={i} className="text-sm text-[var(--color-text)] leading-relaxed relative">
                <span
                  className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[var(--color-bg)]"
                  aria-hidden="true"
                />
                {m}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Chants — ce s-a strigat efectiv în cor */}
      {chants.length > 0 && (
        <div>
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
            <Quote size={14} aria-hidden="true" />
            Sloganuri scandate
          </h3>
          <div className="flex flex-wrap gap-2">
            {chants.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-pill)] bg-emerald-500/10 border border-emerald-500/30 text-xs md:text-sm font-medium text-[var(--color-text)]"
              >
                „{c}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages — pe pancarte / declarații / mesaje publice */}
      {messages.length > 0 && (
        <div>
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
            <MessageSquare size={14} aria-hidden="true" />
            Mesaje transmise
          </h3>
          <ul className="space-y-2">
            {messages.map((m, i) => (
              <li
                key={i}
                className="text-sm text-[var(--color-text)] leading-relaxed pl-3 border-l-2 border-[var(--color-border)] italic"
              >
                „{m}"
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Galerie — client component cu lightbox + masonry aspect-ratio natural */}
      <AftermathGallery images={images} />

      {/* Videos — client component cu lightbox player în-pagină
          (ImageLightbox-equivalent pentru video). Filenames junk
          (upload IDs base64-like) sunt înlocuite cu „Video N". */}
      <AftermathVideos videos={videos} />

      {/* Outcome */}
      {protest.aftermath_outcome && (
        <div>
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Ce a urmat
          </h3>
          <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">
            {protest.aftermath_outcome}
          </p>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="pt-4 border-t border-[var(--color-border)]">
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-2">
            <Newspaper size={14} aria-hidden="true" />
            Surse presă ({sources.length})
          </h3>
          <ul className="space-y-2">
            {sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors"
                >
                  {s.publication && (
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-primary)] mb-1">
                      {s.publication}
                    </p>
                  )}
                  <p className="text-sm font-medium text-[var(--color-text)] leading-snug break-words">
                    {s.title ?? s.url}
                  </p>
                  {s.snippet && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 line-clamp-2">
                      {s.snippet}
                    </p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
