import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  MapPin,
  Phone,
  TreePine,
  Users,
  Wind,
} from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES } from "@/data/counties";
import { getCountyStats } from "@/data/statistici-judete";
import { Badge } from "@/components/ui/Badge";
import { aqiColor, aqiLabel } from "@/components/county/CountyStatCards";
import { STATUS_COLORS, STATUS_LABELS, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";

// ISR: county authorities rarely change; sesizari list is small. 5 min refresh.
export const revalidate = 1800;

interface DbCounty {
  id: string;
  name: string;
  center_lat: number | null;
  center_lng: number | null;
}
interface Authority {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  verified: boolean;
}
interface Sesizare {
  code: string;
  titlu: string;
  status: string;
  tip: string;
  created_at: string;
}

async function getDbCounty(id: string): Promise<DbCounty | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("counties")
    .select("*")
    .eq("id", id.toUpperCase())
    .maybeSingle();
  return data as DbCounty | null;
}

async function getAuthorities(countyId: string): Promise<Authority[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("authorities")
    .select("*")
    .eq("county_id", countyId)
    .order("type");
  return (data ?? []) as Authority[];
}

async function getSesizari(countyId: string): Promise<Sesizare[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("sesizari")
    .select("code, titlu, status, tip, created_at")
    .eq("county", countyId)
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as Sesizare[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const upper = id.toUpperCase();
  const fromList = ALL_COUNTIES.find((c) => c.id === upper);
  const dbCounty = !fromList ? await getDbCounty(id) : null;
  const name = fromList?.name ?? dbCounty?.name;
  return {
    title: name ? `${name} — Sesizări și autorități` : "Județ negăsit",
    description: name
      ? `Depune sesizări în județul ${name}. Vezi autoritățile locale, urmărește rezolvarea problemelor și deschide pagina live a județului.`
      : "",
    alternates: { canonical: `/judete/${id.toLowerCase()}` },
  };
}

const TYPE_LABELS: Record<string, string> = {
  primarie: "Primărie",
  politie_locala: "Poliție Locală",
  consiliu_judetean: "Consiliu Județean",
  prefectura: "Prefectură",
  ipj: "Poliție (IPJ)",
  isu: "ISU",
  dsp: "Sănătate (DSP)",
  isj: "Educație (ISJ)",
  apm: "Mediu (APM)",
  dsvsa: "Veterinar (DSVSA)",
  garda_mediu: "Garda de Mediu",
  other: "Altele",
};

const TYPE_ICONS: Record<string, string> = {
  primarie: "🏛️",
  politie_locala: "🚓",
  consiliu_judetean: "🏛️",
  prefectura: "📜",
  ipj: "👮",
  isu: "🚑",
  dsp: "🏥",
  isj: "🎓",
  apm: "🌿",
  dsvsa: "🐾",
  garda_mediu: "🌳",
  other: "📋",
};

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
  accent?: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-7 h-7 rounded-[var(--radius-xs)] grid place-items-center"
          style={{
            backgroundColor: accent ? `${accent}1a` : "var(--color-surface-2)",
            color: accent ?? "var(--color-text-muted)",
          }}
          aria-hidden="true"
        >
          <Icon size={14} />
        </span>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
          {label}
        </p>
      </div>
      <p
        className="text-xl md:text-2xl font-extrabold tabular-nums leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 leading-tight">
          {hint}
        </p>
      )}
    </div>
  );
}

export default async function CountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const upper = id.toUpperCase();
  const fromList = ALL_COUNTIES.find((c) => c.id === upper);

  // Authorities + recent sesizari + (when needed) the DB county row run
  // in parallel so the slowest one paces the page, not their sum.
  const [dbCounty, authorities, sesizari] = await Promise.all([
    fromList ? Promise.resolve(null) : getDbCounty(id),
    getAuthorities(upper),
    getSesizari(upper),
  ]);

  const county = fromList ?? dbCounty;
  if (!county) notFound();

  const slug = (fromList?.slug ?? id).toLowerCase();
  const stats = fromList ? getCountyStats(fromList.id) : null;
  const isBucharest = upper === "B";

  // Group authorities by type — primary axis for the rendered list.
  const grouped = new Map<string, Authority[]>();
  for (const auth of authorities) {
    const list = grouped.get(auth.type) ?? [];
    list.push(auth);
    grouped.set(auth.type, list);
  }

  const aqiC = stats ? aqiColor(stats.aqiMediu) : "#64748b";
  const aqiL = stats ? aqiLabel(stats.aqiMediu) : "necunoscut";
  const liveTarget = isBucharest ? "Bucureștiul live" : `${county.name} live`;

  return (
    <div className="container-narrow py-8 md:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Județe", url: `${SITE_URL}/judete` },
          { name: county.name, url: `${SITE_URL}/judete/${slug}` },
        ]}
      />

      <Link
        href="/judete"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Toate județele
      </Link>

      {/* Hero — gradient strip with county code chip + name + primary CTAs */}
      <header className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-[#047857] via-[#065f46] to-indigo-900 text-white shadow-[var(--shadow-3)] p-6 md:p-8 mb-8">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(255,255,255,0.18),transparent)]"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl font-extrabold bg-white/15 backdrop-blur-sm border border-white/25 px-3 py-1 rounded-[var(--radius-xs)] shrink-0 tabular-nums">
                {county.id}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-emerald-100/85 font-semibold mb-1">
                  {isBucharest ? "Municipiul Capitalei" : "Județul"}
                </p>
                <h1 className="font-[family-name:var(--font-sora)] text-3xl md:text-5xl font-extrabold leading-tight">
                  {county.name}
                </h1>
              </div>
            </div>
          </div>

          <p className="text-emerald-100/85 max-w-2xl leading-relaxed text-sm md:text-base mb-5">
            {authorities.length > 0
              ? `${authorities.length} autorități indexate · ${sesizari.length} sesizări recente vizibile public.`
              : "Datele autorităților se completează manual — vor apărea aici la următoarele actualizări."}{" "}
            Pagina live a județului are calitatea aerului, întreruperile, statisticile și știrile —{" "}
            <Link href={`/${slug}`} className="underline underline-offset-2 hover:text-white">
              deschide-o aici
            </Link>
            .
          </p>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`/${slug}`}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-full)] bg-white text-[var(--color-primary)] font-semibold hover:bg-white/90 active:scale-[0.97] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700 text-sm"
            >
              <ArrowRight size={14} aria-hidden="true" />
              Deschide {liveTarget}
            </Link>
            <Link
              href={`/sesizari?county=${county.id}`}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-full)] bg-white/10 text-white border border-white/20 font-semibold hover:bg-white/20 active:scale-[0.97] backdrop-blur-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white text-sm"
            >
              <FileText size={14} aria-hidden="true" />
              Sesizări în {county.name}
            </Link>
          </div>
        </div>
      </header>

      {/* Stats strip — only when we have static county-level data
          (which we always do for the 42 official ALL_COUNTIES entries) */}
      {stats && fromList && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatTile
            label="Populație"
            value={fromList.population.toLocaleString("ro-RO")}
            hint="locuitori (Recensământ INS 2021)"
            icon={Users}
            accent="#6366F1"
          />
          <StatTile
            label="Calitate aer"
            value={`AQI ${stats.aqiMediu}`}
            hint={aqiL}
            icon={Wind}
            accent={aqiC}
          />
          <StatTile
            label="Spații verzi"
            value={`${stats.spatiiVerziMpPerLocuitor} m²`}
            hint="per locuitor (recomandat OMS: 9+)"
            icon={TreePine}
            accent="#059669"
          />
          <StatTile
            label="Primar reședință"
            value={stats.primarName}
            hint={stats.primarPartid}
            icon={Award}
            accent="#64748B"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Authorities */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold inline-flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center"
                aria-hidden="true"
              >
                <Building2 size={14} />
              </span>
              Autorități locale
            </h2>
            {authorities.length > 0 && (
              <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                {authorities.length} indexate · {grouped.size} categorii
              </span>
            )}
          </div>

          {grouped.size === 0 ? (
            <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
              <Building2
                size={28}
                className="mx-auto mb-3 text-[var(--color-text-muted)]"
                aria-hidden="true"
              />
              <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mb-3">
                Încă nu avem autorități indexate pentru acest județ. Datele se
                completează manual și vor apărea în următoarele actualizări.
              </p>
              <Link
                href={`/${slug}/autoritati`}
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
              >
                Vezi autoritățile general disponibile{" "}
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from(grouped.entries()).map(([type, auths]) => (
                <section key={type}>
                  <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                    <span aria-hidden="true">{TYPE_ICONS[type] ?? "📋"}</span>
                    {TYPE_LABELS[type] ?? type}
                    <span className="opacity-70 normal-case font-normal tabular-nums">
                      ({auths.length})
                    </span>
                  </h3>
                  <ul className="space-y-2">
                    {auths.map((auth) => (
                      <li
                        key={auth.id}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm leading-snug">
                              {auth.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
                              {auth.email && (
                                <a
                                  href={`mailto:${auth.email}`}
                                  className="inline-flex items-center gap-1 hover:text-[var(--color-primary)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                                >
                                  <Mail size={11} aria-hidden="true" /> {auth.email}
                                </a>
                              )}
                              {auth.phone && (
                                <a
                                  href={`tel:${auth.phone.replace(/\s/g, "")}`}
                                  className="inline-flex items-center gap-1 hover:text-[var(--color-primary)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                                >
                                  <Phone size={11} aria-hidden="true" /> {auth.phone}
                                </a>
                              )}
                              {auth.website && (
                                <a
                                  href={auth.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:text-[var(--color-primary)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                                >
                                  <Globe size={11} aria-hidden="true" /> Site
                                  <ExternalLink size={9} aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>
                          {auth.verified && (
                            <Badge variant="success" className="text-[10px]">
                              ✓ Verificat
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <section>
            <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold mb-3 inline-flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-[var(--radius-xs)] bg-blue-500/15 text-blue-600 grid place-items-center"
                aria-hidden="true"
              >
                <FileText size={12} />
              </span>
              Sesizări recente
            </h2>
            {sesizari.length === 0 ? (
              <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-5 text-center">
                <p className="text-[var(--color-text-muted)] text-xs mb-3 leading-relaxed">
                  Nicio sesizare publică încă în {county.name}.
                </p>
                <Link
                  href="/sesizari"
                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  Fii primul care raportează →
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {sesizari.map((s) => {
                  const dotColor = STATUS_COLORS[s.status] ?? "#64748b";
                  const statusText = STATUS_LABELS[s.status] ?? s.status;
                  return (
                    <li key={s.code}>
                      <Link
                        href={`/sesizari/${s.code}`}
                        aria-label={`Sesizarea ${s.code}: ${s.titlu} — ${statusText}`}
                        className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 hover:border-[var(--color-primary)]/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: dotColor }}
                            aria-hidden="true"
                          />
                          <span className="font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums">
                            {s.code}
                          </span>
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: dotColor }}
                          >
                            {statusText}
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-2 leading-snug">
                          {s.titlu}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 tabular-nums">
                          <time dateTime={s.created_at}>
                            {new Date(s.created_at).toLocaleDateString("ro-RO", {
                              timeZone: "Europe/Bucharest",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </time>
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Quick links to live county surfaces */}
          <section>
            <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold mb-3 inline-flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-[var(--radius-xs)] bg-emerald-500/15 text-emerald-600 grid place-items-center"
                aria-hidden="true"
              >
                <MapPin size={12} />
              </span>
              {county.name} live
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {[
                { href: `/${slug}/aer`, label: "Calitate aer", emoji: "🌬️" },
                { href: `/${slug}/stiri`, label: "Știri", emoji: "📰" },
                { href: `/${slug}/intreruperi`, label: "Întreruperi", emoji: "⚠️" },
                { href: `/${slug}/autoritati`, label: "Autorități", emoji: "🏛️" },
                { href: `/${slug}/sesizari`, label: "Sesizări", emoji: "📋" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    <span aria-hidden="true">{l.emoji}</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
