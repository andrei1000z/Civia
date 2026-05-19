import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  ExternalLink,
  Building2,
  Home,
} from "lucide-react";
import {
  getInterruptionById,
  getInterruptionsForCounty,
  INTRERUPERI,
  TYPE_COLORS,
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/data/intreruperi";
import { SITE_URL } from "@/lib/constants";
import { after } from "next/server";
import {
  getCachedBuildings,
  getBuildingsForOutage,
  warmBuildingsBackground,
  summarizeAffectedBuildings,
} from "@/lib/intreruperi/buildings";
import { ShareButton } from "./ShareButton";
import { MapClient } from "./MapClient";
import { CalendarMenu } from "./CalendarMenu";
import { getCountyBySlug } from "@/data/counties";
import { CountyIntreruperiContent } from "../_county-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // Dispatch: cand id = county slug, returnam metadata pentru county page.
  const county = getCountyBySlug(id);
  if (county) {
    return {
      title: `Întreruperi programate — ${county.name}`,
      description: `Întreruperi de apă, caldură, gaz, curent + lucrări la stradă în ${county.name}. Catalogat din anunțuri oficiale ale operatorilor locali.`,
      alternates: { canonical: `/intreruperi/${county.slug}` },
    };
  }

  const item = await getInterruptionById(id);
  if (!item) return {};
  const title = `${TYPE_ICONS[item.type]} ${TYPE_LABELS[item.type]} — ${item.addresses[0] ?? item.reason}`;
  return {
    title,
    description: item.excerpt ?? `${item.reason}. Provider: ${item.provider}.`,
    alternates: { canonical: `/intreruperi/${item.id}` },
    openGraph: {
      title,
      description: item.excerpt ?? item.reason,
      type: "article",
      locale: "ro_RO",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: item.excerpt ?? item.reason,
    },
    keywords: [
      TYPE_LABELS[item.type],
      item.provider,
      item.locality ?? "",
      item.county === "B" ? "București" : item.county,
      ...item.addresses.slice(0, 3),
    ].filter(Boolean),
  };
}

// Outage detail content is essentially fixed after the scrape:
// provider, addresses, start/end times don't change. Status flips
// occasionally (programat → in-desfasurare → finalizat).
// 2026-05-19: ridicat de la 1h → 6h (21600s) — Vercel ISR Writes
// over-limit. Cu ~50 outages × 24 writes/zi = 36K/lună la 1h.
// 6h = 6K/lună. Status flip-uri rare oricum, refresh activ via
// /api/intreruperi/refresh care apoi face revalidatePath.
export const revalidate = 21600;

// 60s function budget so the inline Overpass fallback (up to ~45s on
// the slow kumi.systems mirror) can complete on a cache-cold page,
// AND the after() warming hook still has headroom afterwards. Default
// 10s was killing both: inline fetch raced past it, after() never
// got time to write the cache for the next viewer.
export const maxDuration = 60;

export async function generateStaticParams() {
  return INTRERUPERI.map((i) => ({ id: i.id }));
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationLabel(startAt: string, endAt: string): string {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return `${h} ore`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "zi" : "zile"}`;
}

export default async function InterruptionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Dispatch: cand id e un county slug (b, cj, is, …) randam pagina
  // dedicata de county in loc de pagina de outage detail. Asta permite
  // URL-uri tip /intreruperi/b in loc de /b/intreruperi.
  const county = getCountyBySlug(id);
  if (county) {
    return <CountyIntreruperiContent county={county} />;
  }

  const item = await getInterruptionById(id);
  if (!item) notFound();

  // County-scoped fetch instead of pulling the full national catalog
  // just to filter to the same county. Same in-memory store, but the
  // helper trims the working set right away — and once we cache the
  // store layer per-county (TODO) this becomes a real DB-side filter.
  const sameCounty = await getInterruptionsForCounty(item.county);
  const related = sameCounty
    .filter((i) => i.id !== item.id && i.status !== "finalizat")
    .slice(0, 4);

  // Pull the OSM building polygons (cached or freshly fetched) and
  // boil them down into a per-street address list. Strategy:
  //   1. Try Redis cache first — instant when the warming cron has
  //      already covered this outage.
  //   2. On cache miss, race a single Overpass fetch against a 12s
  //      timeout. The page's 5-min ISR window means the slow path
  //      runs at most once per 5 min per outage, not per request.
  //   3. Whether or not the inline fetch produced data, fire a
  //      background warming job (NX-locked) so the next viewer
  //      definitely sees a populated cache.
  let buildingsSummary: ReturnType<typeof summarizeAffectedBuildings> | null = null;
  if (item.lat != null && item.lng != null) {
    const radiusM = (() => {
      const pop = item.affectedPopulation ?? item.addresses.length * 200;
      // Same formula IntreruperiMap + the buildings API use, so the
      // cache key matches and we never pay Overpass twice.
      return Math.max(200, Math.min(2500, Math.round(150 * Math.sqrt(pop / 1000))));
    })();
    const cached = await getCachedBuildings(item.id);
    let polygons = cached;
    if (!polygons) {
      // 2026-05-19: Vercel Fluid CPU over-limit. Inainte: race de 50s
      // pe Overpass — fiecare cache-miss costa 50s CPU. Acum: 8s race +
      // fire after() warm in background. User-ul vede pagina rapid,
      // buildings apare la next visit (cache populat de warm-er).
      try {
        polygons = await Promise.race([
          getBuildingsForOutage(item.id, item.lat, item.lng, radiusM),
          new Promise<typeof cached>((resolve) =>
            setTimeout(() => resolve(null), 8_000),
          ),
        ]);
      } catch {
        polygons = null;
      }
    }
    if (polygons && polygons.length > 0) {
      buildingsSummary = summarizeAffectedBuildings(polygons);
    }
    // Belt-and-suspenders: even if the inline fetch succeeded, queue
    // a background warm so a newer Overpass dataset (or a v3 schema
    // bump someday) refreshes without page latency. NX-locked inside
    // warmBuildingsBackground so concurrent visitors don't pile on.
    after(async () => {
      await warmBuildingsBackground([
        { id: item.id, lat: item.lat!, lng: item.lng!, radiusM },
      ]);
    });
  }

  // Schema.org Event JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${TYPE_LABELS[item.type]} — ${item.addresses[0] ?? item.reason}`,
    description: item.excerpt ?? item.reason,
    startDate: item.startAt,
    endDate: item.endAt,
    eventStatus:
      item.status === "anulat"
        ? "https://schema.org/EventCancelled"
        : item.status === "in-desfasurare"
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: item.addresses.slice(0, 2).join(", "),
      address: {
        "@type": "PostalAddress",
        addressCountry: "RO",
        addressLocality: item.locality ?? "",
        addressRegion: item.county,
      },
      ...(item.lat != null && item.lng != null
        ? {
            geo: {
              "@type": "GeoCoordinates",
              latitude: item.lat,
              longitude: item.lng,
            },
          }
        : {}),
    },
    organizer: {
      "@type": "Organization",
      name: item.provider,
      url: item.sourceUrl,
    },
    url: `${SITE_URL}/intreruperi/${item.id}`,
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/intreruperi"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Toate întreruperile
      </Link>

      <header
        className="mb-8 pl-4 border-l-4"
        style={{ borderLeftColor: TYPE_COLORS[item.type] }}
      >
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: TYPE_COLORS[item.type] + "25",
              color: TYPE_COLORS[item.type],
            }}
          >
            {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
          </span>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: STATUS_COLORS[item.status] + "25",
              color: STATUS_COLORS[item.status],
            }}
          >
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-4xl font-extrabold mb-2">
          {item.reason}
        </h1>
        {item.excerpt && (
          <p className="text-base text-[var(--color-text-muted)] leading-relaxed">
            {item.excerpt}
          </p>
        )}
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <div>
          {/* Info block */}
          <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 mb-6 space-y-4">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Interval
              </h2>
              <p className="text-sm">
                <strong>Început:</strong> {formatDateTime(item.startAt)}
              </p>
              <p className="text-sm">
                <strong>Sfârșit estimat:</strong> {formatDateTime(item.endAt)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Durată: {durationLabel(item.startAt, item.endAt)}
              </p>
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                <MapPin size={12} /> Adrese afectate (din anunțul oficial)
              </h2>
              <ul className="space-y-1">
                {item.addresses.map((addr, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-[var(--color-primary)] mt-0.5">•</span>
                    {addr}
                  </li>
                ))}
              </ul>
            </div>

            {/* OSM-derived list: every building in the affected radius
                grouped by street + house number. Complements the
                provider's address list — providers usually publish a
                short street-level summary, but the OSM polygons let
                us show "Strada Magheru — nr. 12, 14, 16, 18" with the
                exact buildings. Hidden when no cached polygons exist
                (new outage, cron hasn't warmed yet). */}
            {buildingsSummary && buildingsSummary.streets.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                  <Home size={12} /> Clădiri în zona afectată ({buildingsSummary.total})
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
                  Listă generată automat din OpenStreetMap pentru raza
                  estimată a întreruperii. Poate include clădiri vecine
                  sau omite unele care nu sunt cartografiate încă.
                </p>
                <ul className="space-y-2.5">
                  {buildingsSummary.streets.map((s, i) => (
                    <li
                      key={i}
                      className="text-sm bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] px-3 py-2.5"
                    >
                      <p className="font-semibold mb-1 flex items-center gap-2 flex-wrap">
                        <span>{s.street}</span>
                        <span className="text-[10px] font-normal text-[var(--color-text-muted)] tabular-nums">
                          {s.count} {s.count === 1 ? "clădire" : "clădiri"}
                        </span>
                      </p>
                      {s.housenumbers.length > 0 && (
                        <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
                          <span className="text-[var(--color-text-muted)]">nr.</span>{" "}
                          <span className="tabular-nums">
                            {s.housenumbers.join(", ")}
                          </span>
                        </p>
                      )}
                      {s.namedBuildings.length > 0 && (
                        <p className="text-[12px] text-[var(--color-text-muted)] mt-1 italic">
                          {s.namedBuildings.join(" · ")}
                        </p>
                      )}
                      {s.housenumbers.length === 0 && s.namedBuildings.length === 0 && (
                        <p className="text-[11px] text-[var(--color-text-muted)] italic">
                          Numere de stradă necartografiate
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {buildingsSummary.unstreetedNamedBuildings.length > 0 && (
                  <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
                    <p className="font-medium mb-1">Și alte locații în zonă:</p>
                    <p className="leading-relaxed">
                      {buildingsSummary.unstreetedNamedBuildings.join(" · ")}
                    </p>
                  </div>
                )}
                {buildingsSummary.untaggedCount > 0 && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-3 italic">
                    + {buildingsSummary.untaggedCount}{" "}
                    {buildingsSummary.untaggedCount === 1 ? "clădire" : "clădiri"} fără
                    adresă în OpenStreetMap.
                  </p>
                )}
              </div>
            )}

            {item.affectedPopulation != null && item.affectedPopulation > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                  <Users size={12} /> Populație afectată
                </h2>
                <p className="text-sm">
                  Aproximativ <strong>{item.affectedPopulation.toLocaleString("ro-RO")}</strong>{" "}
                  persoane
                </p>
              </div>
            )}
          </section>

          {/* Map */}
          {item.lat != null && item.lng != null && (
            <section className="mb-6">
              <h2 className="font-semibold mb-3">Locația pe hartă</h2>
              <MapClient
                coords={[item.lat, item.lng]}
                label={item.reason}
                color={TYPE_COLORS[item.type]}
                zoom={15}
                height="320px"
              />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
              <Building2 size={12} /> Provider
            </p>
            <p className="font-medium mb-3">{item.provider}</p>
            <div className="flex flex-col gap-2">
              {item.sourceEntryUrl && (
                <a
                  href={item.sourceEntryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline font-medium"
                  title={item.sourceEntryTitle}
                >
                  <ExternalLink size={11} />
                  {item.sourceEntryUrl.toLowerCase().endsWith(".pdf")
                    ? "PDF oficial"
                    : "Anunț oficial"}
                </a>
              )}
              {item.sourceUrl && item.sourceUrl !== item.sourceEntryUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:underline"
                  title={`Lista ${item.provider} cu toate anunțurile active`}
                >
                  <ExternalLink size={10} /> Toate anunțurile providerului
                </a>
              )}
              {!item.sourceEntryUrl && !item.sourceUrl && (
                <span className="text-[11px] text-[var(--color-text-muted)] italic">
                  Linkul direct la anunț urmează să fie adăugat.
                </span>
              )}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3">
              Acțiuni
            </p>
            <div className="flex flex-col gap-2">
              <CalendarMenu item={item} />
              <ShareButton
                id={item.id}
                title={`${TYPE_ICONS[item.type]} ${TYPE_LABELS[item.type]} — ${item.addresses[0] ?? ""}`}
                text={item.reason}
              />
            </div>
          </div>

          {item.county && (
            <Link
              href={`/${item.county.toLowerCase()}/intreruperi`}
              className="block bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/20 rounded-[var(--radius-md)] p-5 hover:bg-[var(--color-primary-soft)]/70 transition-colors"
            >
              <p className="text-xs uppercase tracking-wider font-semibold text-[var(--color-primary)] mb-1">
                Vezi toate din {item.county === "B" ? "București" : item.county}
              </p>
              <p className="text-sm text-[var(--color-text)]">
                Alte întreruperi programate în această zonă →
              </p>
            </Link>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-4">
            Alte întreruperi în {item.county === "B" ? "București" : item.county}
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/intreruperi/${r.id}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)]/40 transition-all flex gap-3"
                style={{ borderLeftWidth: "3px", borderLeftColor: TYPE_COLORS[r.type] }}
              >
                <span className="text-2xl shrink-0">{TYPE_ICONS[r.type]}</span>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                    {TYPE_LABELS[r.type]}
                  </p>
                  <p className="font-medium text-sm line-clamp-2 mb-1">{r.reason}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {r.addresses[0] ?? ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
