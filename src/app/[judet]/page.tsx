import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AlertCircle,
  Map as MapIcon,
  Wind,
  Newspaper,
  BookOpen,
  Building2,
  ArrowRight,
  AlertTriangle,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  Megaphone,
  Users as UsersIcon,
  ExternalLink,
  Compass,
} from "lucide-react";
import { ALL_COUNTIES, getCountyBySlug } from "@/data/counties";
import { getCountyStats } from "@/data/statistici-judete";
import {
  PRIMARII,
  PREFECTURI,
  POLITIA_LOCALA_JUDET,
} from "@/data/autoritati-contact";
import type { AuthorityContact } from "@/data/autoritati-contact";
import {
  getInterruptionsForCounty,
  TYPE_ICONS as INTRERUPERI_ICONS,
  TYPE_LABELS as INTRERUPERI_LABELS,
} from "@/data/intreruperi";
import { CountyStatCards, aqiColor } from "@/components/county/CountyStatCards";
import { FollowAreaButton } from "@/components/area/FollowAreaButton";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { CountyPlaceJsonLd } from "@/components/JsonLd";
import { SITE_URL, STATUS_COLORS, STATUS_LABELS, sourceTextColor } from "@/lib/constants";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function generateStaticParams() {
  return ALL_COUNTIES.map((c) => ({ judet: c.slug }));
}

// Live data — sesizări + știri + interruptions counts.
// 2026-05-24 (Wave 4 perf audit): coborât 24h → 6h. Datele county-level
// schimbă des și ISR on-demand acoperă writes — 6h e fallback safety net,
// nu cap real. Audit-ul masiv P0 a marcat 24h ca „stale prea mult".
export const revalidate = 21600;

// Hero photo per oraș mare. Fallback gradient pur pentru județele
// fără poză custom (codul condiționează existența cheii în map).
// 5/22/2026 — hero photo per oraș dezactivat la cererea user-ului. Map-ul
// stays pentru re-activare facilă (drop file + reintrodu render block).
// Prefix `_` = ESLint ignora unused-var rule.
const _HERO_PHOTO_BY_SLUG: Record<string, string> = {
  b: "/images/home/hero-bucuresti.webp",
  cj: "/images/home/hero-cluj.webp",
  bv: "/images/home/hero-brasov.webp",
  tm: "/images/home/hero-timisoara.webp",
  ct: "/images/home/hero-constanta.webp",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  // No title here — the parent [judet]/layout.tsx already sets a
  // `${county.name} — Civia` default. Setting one here would compose
  // with that layout's template (`%s — ${county.name} — Civia`) and
  // produce the duplicate `Cluj — Cluj — Civia`.
  return {
    description: `Sesizări, calitate aer, statistici și ghiduri civice pentru județul ${county.name}.`,
    alternates: { canonical: `/${county.slug}` },
  };
}

interface RecentSesizare {
  code: string;
  titlu: string;
  status: string;
  tip: string;
  created_at: string;
}

interface RecentStire {
  id: string;
  title: string;
  source: string;
  image_url: string | null;
  published_at: string;
}

async function fetchRecentSesizari(countyId: string): Promise<{
  rows: RecentSesizare[];
  totalCount: number;
}> {
  try {
    const admin = createSupabaseAdmin();
    const [list, count] = await Promise.all([
      admin
        .from("sesizari")
        .select("code, titlu, status, tip, created_at")
        .eq("county", countyId)
        .eq("moderation_status", "approved")
        .eq("publica", true)
        .order("created_at", { ascending: false })
        .limit(4),
      admin
        .from("sesizari")
        .select("*", { count: "exact", head: true })
        .eq("county", countyId)
        .eq("moderation_status", "approved")
        .eq("publica", true),
    ]);
    return {
      rows: (list.data ?? []) as RecentSesizare[],
      totalCount: count.count ?? 0,
    };
  } catch {
    return { rows: [], totalCount: 0 };
  }
}

async function fetchRecentStiri(countyId: string): Promise<RecentStire[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("stiri_cache")
      .select("id, title, source, image_url, published_at")
      .contains("counties", [countyId])
      .order("published_at", { ascending: false })
      .limit(4);
    return (data ?? []) as RecentStire[];
  } catch {
    return [];
  }
}

const COUNTY_TIP_LABEL: Record<string, string> = {
  groapa: "Groapă",
  trotuar: "Trotuar",
  iluminat: "Iluminat",
  copac: "Copac",
  gunoi: "Gunoi",
  parcare: "Parcare",
  stalpisori: "Stâlpișori",
  canalizare: "Canalizare",
  semafor: "Semafor",
  pietonal: "Pietonal",
  graffiti: "Graffiti",
  mobilier: "Mobilier",
  zgomot: "Zgomot",
  animale: "Animale",
  transport: "Transport",
  altele: "Altele",
};

// Hero quick-tiles below the headline. 4 hand-picked because that's
// the count that fits nicely without horizontal scroll on tablets.
function HeroQuickTiles({
  judet,
  totalSesizari,
  intreruperiCount,
  aqi,
  aqiQuality,
}: {
  judet: string;
  totalSesizari: number;
  intreruperiCount: number;
  aqi: number;
  aqiQuality: string;
}) {
  // Tile-ul „Primar reședință" a fost eliminat — primarul apare deja
  // ca rol al cardului Primărie din secțiunea „Cu cine vorbești", deci
  // mai jos. Era duplicat informațional.
  const tiles = [
    {
      href: `/${judet}/sesizari`,
      label: "Sesizări active",
      value: totalSesizari.toLocaleString("ro-RO"),
      hint: totalSesizari === 0 ? "fii primul care raportează" : "depuse public",
      icon: AlertCircle,
      color: "#DC2626",
    },
    {
      href: `/intreruperi/${judet}`,
      label: "Întreruperi azi",
      value: intreruperiCount.toLocaleString("ro-RO"),
      hint: intreruperiCount === 0 ? "nimic activ" : "apă/curent/gaz",
      icon: AlertTriangle,
      color: "#F59E0B",
    },
    {
      href: `/${judet}/autoritati`,
      label: "Autorități",
      value: "Catalog",
      hint: "primărie, prefectură, ipj",
      icon: AlertCircle,
      color: "#059669",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-children">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.label}
            href={t.href}
            className="group bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-1)] rounded-[var(--radius-md)] p-4 hover:shadow-[var(--shadow-2)] card-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-7 h-7 rounded-[var(--radius-xs)] grid place-items-center shrink-0"
                style={{ backgroundColor: `${t.color}25`, color: t.color }}
                aria-hidden="true"
              >
                <Icon size={13} />
              </span>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                {t.label}
              </p>
            </div>
            <p
              className="text-base lg:text-xl font-extrabold leading-tight tabular-nums truncate text-[var(--color-text)]"
              title={String(t.value)}
            >
              {t.value}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
              {t.hint}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

// Recent-sesizari column — server-rendered with live DB data. Empty
// state CTAs back to the sesizare flow so the page is always actionable.
function RecentSesizariColumn({
  countyName,
  countySlug,
  rows,
}: {
  countyName: string;
  countySlug: string;
  rows: RecentSesizare[];
}) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-[family-name:var(--font-sora)] font-extrabold text-base inline-flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-[var(--radius-xs)] bg-rose-500/15 text-rose-600 grid place-items-center"
            aria-hidden="true"
          >
            <AlertCircle size={14} />
          </span>
          Sesizări recente
        </h3>
        <Link
          href={`/${countySlug}/sesizari`}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          Toate <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-xs)] p-5 text-center">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-2">
            Nicio sesizare publică încă în {countyName}.
          </p>
          <Link
            href={`/${countySlug}/sesizari`}
            className="text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            Fii primul care raportează →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const dot = STATUS_COLORS[s.status] ?? "#64748b";
            const tipLabel = COUNTY_TIP_LABEL[s.tip] ?? s.tip;
            return (
              <li key={s.code}>
                <Link
                  href={`/sesizari/${s.code}`}
                  className="block bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 rounded-[var(--radius-xs)] p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dot }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: dot }}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                      · {tipLabel}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-muted)] ml-auto">
                      {s.code}
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
  );
}

function RecentStiriColumn({
  countyName,
  countySlug,
  rows,
}: {
  countyName: string;
  countySlug: string;
  rows: RecentStire[];
}) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-[family-name:var(--font-sora)] font-extrabold text-base inline-flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-[var(--radius-xs)] bg-sky-500/15 text-sky-600 grid place-items-center"
            aria-hidden="true"
          >
            <Newspaper size={14} />
          </span>
          Știri locale
        </h3>
        <Link
          href={`/${countySlug}/stiri`}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          Toate <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-xs)] p-5 text-center">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-2">
            Nicio știre indexată pentru {countyName} în catalogul local.
          </p>
          <Link
            href={`/${countySlug}/stiri`}
            className="text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            Vezi sursele naționale →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const textTint = sourceTextColor(s.source);
            return (
              <li key={s.id}>
                <Link
                  href={`/stiri/${s.id}`}
                  className="flex items-start gap-3 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 rounded-[var(--radius-xs)] p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  {/* Thumbnail container — visible neutral bg + Newspaper
                      icon ca fallback. unoptimized bypassează /_next/image
                      proxy (eșua pentru anumite feed-uri externe → black box).
                      Vechiul cod folosea source-color la 10% alpha care era
                      invizibil pe dark mode pentru surse near-black (G4Media). */}
                  <div className="relative w-14 h-14 rounded-[var(--radius-xs)] overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
                    <div
                      className="absolute inset-0 grid place-items-center"
                      style={{ color: textTint }}
                      aria-hidden="true"
                    >
                      <Newspaper size={20} className="opacity-80" />
                    </div>
                    {s.image_url && (
                      <Image
                        src={s.image_url}
                        alt=""
                        fill
                        sizes="56px"
                        unoptimized
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: textTint }}
                      >
                        {s.source}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                        ·{" "}
                        <time dateTime={s.published_at}>
                          {new Date(s.published_at).toLocaleDateString("ro-RO", {
                            timeZone: "Europe/Bucharest",
                            day: "numeric",
                            month: "short",
                          })}
                        </time>
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2">
                      {s.title}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ActiveInterruperiColumn({
  countyName,
  countySlug,
  rows,
}: {
  countyName: string;
  countySlug: string;
  rows: Awaited<ReturnType<typeof getInterruptionsForCounty>>;
}) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-[family-name:var(--font-sora)] font-extrabold text-base inline-flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-[var(--radius-xs)] bg-amber-500/15 text-amber-600 grid place-items-center"
            aria-hidden="true"
          >
            <AlertTriangle size={14} />
          </span>
          Întreruperi active
        </h3>
        <Link
          href={`/intreruperi/${countySlug}`}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          Toate <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-xs)] p-5 text-center">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Nicio întrerupere activă în {countyName}. 🎉
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 4).map((i) => {
            const startsAt = new Date(i.startAt);
            const endsAt = new Date(i.endAt);
            return (
              <li
                key={i.id}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span aria-hidden="true">{INTRERUPERI_ICONS[i.type] ?? "⚠️"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {INTRERUPERI_LABELS[i.type] ?? i.type}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                    · {i.locality}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2">
                  {i.sourceEntryTitle ?? i.reason ?? "Întrerupere planificată"}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 tabular-nums">
                  <time dateTime={i.startAt}>
                    {startsAt.toLocaleString("ro-RO", {
                      timeZone: "Europe/Bucharest",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>{" "}
                  →{" "}
                  <time dateTime={i.endAt}>
                    {endsAt.toLocaleString("ro-RO", {
                      timeZone: "Europe/Bucharest",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AuthorityCard({
  name,
  role,
  icon: Icon,
  iconColor,
  contact,
  href,
}: {
  name: string;
  role: string;
  icon: typeof Building2;
  iconColor: string;
  contact?: AuthorityContact;
  href?: string;
}) {
  const inner = (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 rounded-[var(--radius-md)] shadow-[var(--shadow-1)] card-lift p-5 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-10 h-10 rounded-[var(--radius-xs)] grid place-items-center shrink-0"
          style={{ backgroundColor: `${iconColor}15`, color: iconColor }}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{name}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{role}</p>
        </div>
      </div>
      {contact ? (
        <ul className="space-y-1.5 text-xs">
          {contact.phone && (
            <li className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)] mr-3">
              <Phone size={10} aria-hidden="true" />
              <span className="tabular-nums">{contact.phone}</span>
            </li>
          )}
          {contact.email && (
            <li>
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
              >
                <Mail size={10} aria-hidden="true" />
                {contact.email}
              </a>
            </li>
          )}
          {contact.website && (
            <li>
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
              >
                <Globe size={10} aria-hidden="true" />
                Site
                <ExternalLink size={9} aria-hidden="true" />
              </a>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-[11px] text-[var(--color-text-muted)] italic">
          Contact în curs de colectare.
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-[var(--radius-md)]">
        {inner}
      </Link>
    );
  }
  return inner;
}

const PRIMARY_SECTIONS = [
  { path: "/sesizari", icon: AlertCircle, label: "Sesizări", color: "#DC2626", prefetch: true },
  { path: "/intreruperi", icon: AlertTriangle, label: "Întreruperi", color: "#F59E0B", prefetch: true },
  { path: "/autoritati", icon: AlertCircle, label: "Autorități", color: "#059669", prefetch: true },
  { path: "/stiri", icon: Newspaper, label: "Știri locale", color: "#0EA5E9", prefetch: false },
];

// SECONDARY_SECTIONS = "Tot despre {judet}" grid. Round 2026-05-04:
// dezintegrat /statistici, /cum-functioneaza, /bilete, /buget, /compara
// la cererea user-ului. Rămân doar surfacele păstrate.
// 2026-05-19: scoase /educatie /sanatate /siguranta — ghost pages cu < 5% CTR.
// Continutul real e in /ghiduri si in dashboard-ul de statistici.
const SECONDARY_SECTIONS = [
  { path: "/ghiduri", icon: BookOpen, label: "Ghiduri", color: "#A855F7" },
];

export default async function CountyHomePage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) notFound();

  const stats = getCountyStats(county.id);
  const isBucharest = county.id === "B";

  // Genitive form for the hero headline.
  const heroGenitiveTarget = isBucharest
    ? "Bucureștiului."
    : `județului ${county.name}.`;

  // Live data — sesizari + stiri DB-fan-out, intreruperi from Supabase
  // (scraped) merged with static seed. All in parallel so the slowest
  // dependency paces the page.
  // eslint-disable-next-line react-hooks/purity -- ISR Server Component, Date.now() captured per regeneration
  const nowMs = Date.now();
  const [
    allInterruptions,
    { rows: recentSesizari, totalCount: sesizariTotalCount },
    recentStiri,
  ] = await Promise.all([
    getInterruptionsForCounty(county.id),
    fetchRecentSesizari(county.id),
    fetchRecentStiri(county.id),
  ]);
  const activeInterruptions = allInterruptions.filter(
    (i) =>
      i.status !== "anulat" &&
      i.status !== "finalizat" &&
      new Date(i.endAt).getTime() > nowMs,
  );

  // Authority lookups — static data file, sync access. Bucharest uses
  // its own dedicated detail elsewhere; the home hub still surfaces a
  // top-3 trio (primărie + prefectură + poliție locală).
  const primarie = PRIMARII[county.id];
  const prefectura = PREFECTURI[county.id];
  const politialocala = POLITIA_LOCALA_JUDET[county.id];

  // 5/22/2026 — hero photo scos. Nu mai preload-am imagine.

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: county.name, url: `${SITE_URL}/${county.slug}` },
        ]}
      />
      <CountyPlaceJsonLd
        countyName={county.name}
        countySlug={county.slug}
        countyId={county.id}
        description={`Sesizări civice, statistici locale, autorități și știri pentru ${county.name}. Civia agregă date publice și permite cetățenilor să raporteze probleme către primării.`}
        population={stats?.populatie}
        url={`${SITE_URL}/${county.slug}`}
      />

      {/* ─── HERO ─── (gradient pinned to design tokens — same as
          the national homepage hero so they read as one product). */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-emerald-800 to-[#0a0a0a] text-white">
        {/* 5/22/2026 — user a cerut sa scoata imaginile de fundal cu orase.
            Pastram doar gradient curat cu 3 radiale pentru profunzime.
            _HERO_PHOTO_BY_SLUG ramane definit (poate fi reactivat) dar nu
            mai e folosit aici. */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_30%,rgba(56,189,248,0.18),transparent)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_20%_80%,rgba(16,185,129,0.20),transparent)]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-10" aria-hidden="true" />

        <div className="container-narrow relative z-10 py-14 md:py-20">
          <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white border border-white/20 text-xs font-semibold mb-6 backdrop-blur-sm">
                🇷🇴 Platformă civică independentă · gratuit · fără reclame
              </p>

              <h1 className="font-[family-name:var(--font-sora)] text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight mb-5 sm:mb-6 break-words">
                Ajută la schimbarea
                <br className="hidden sm:block" />{" "}
                <span className="bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                  {heroGenitiveTarget}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-emerald-100/85 max-w-xl leading-relaxed mb-8">
                Tot ce ține de {isBucharest ? "Bucureștiul tău" : `județul ${county.name}`} într-un singur loc — sesizări la primărie, calitate aer live, întreruperi programate și știri locale.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${judet}/sesizari`}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-full)] bg-white text-[var(--color-primary)] font-semibold hover:bg-white/90 active:scale-[0.97] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700"
                >
                  <AlertCircle size={18} aria-hidden="true" />
                  Fă o sesizare
                </Link>
                <Link
                  href={`/intreruperi/${judet}`}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-full)] bg-white/10 text-white border border-white/20 font-semibold hover:bg-white/20 active:scale-[0.97] backdrop-blur-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <AlertCircle size={18} aria-hidden="true" />
                  Vezi întreruperi
                </Link>
              </div>
            </div>

            <CountyStatCards countyName={county.name} stats={stats} variant="floating" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--color-bg)] to-transparent pointer-events-none" />
      </section>

      {/* ─── Live signal strip — overlaps the hero bottom edge ─── */}
      <section className="relative -mt-6 z-10">
        <div className="container-narrow">
          <HeroQuickTiles
            judet={judet}
            totalSesizari={sesizariTotalCount}
            intreruperiCount={activeInterruptions.length}
            aqi={stats.aqiMediu}
            aqiQuality={stats.aqiQuality}
          />
        </div>
      </section>

      {/* „Urmărește zona" (Faza 2) — abonare la digestul local săptămânal */}
      <section className="relative z-10 mt-5">
        <div className="container-narrow flex justify-center">
          <FollowAreaButton county={county.id} countyName={county.name} source="county_page" />
        </div>
      </section>

      {/* ─── Mobile stat cards (lg- only) ─── */}
      <section className="lg:hidden py-6">
        <div className="container-narrow">
          <CountyStatCards countyName={county.name} stats={stats} variant="grid" />
        </div>
      </section>

      {/* ─── Live activity row — three columns ─── */}
      <section className="py-10 md:py-14">
        <div className="container-narrow">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold">
                Ce se întâmplă acum în {county.name}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Date live — sesizări depuse de cetățeni, știri din presa locală, întreruperi
                programate ale operatorilor.
              </p>
            </div>
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            <RecentSesizariColumn
              countyName={county.name}
              countySlug={county.slug}
              rows={recentSesizari}
            />
            <RecentStiriColumn
              countyName={county.name}
              countySlug={county.slug}
              rows={recentStiri}
            />
            <ActiveInterruperiColumn
              countyName={county.name}
              countySlug={county.slug}
              rows={activeInterruptions}
            />
          </div>
        </div>
      </section>

      {/* ─── Authorities preview ─── */}
      <section className="pb-10 md:pb-14">
        <div className="container-narrow">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold">
                Cu cine vorbești în {county.name}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Top 3 instituții cu contact direct — email, telefon, adresă.{" "}
                <Link
                  href={`/${judet}/autoritati`}
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Vezi catalogul complet →
                </Link>
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AuthorityCard
              name={
                isBucharest
                  ? "Primăria Municipiului București"
                  : `Primăria ${county.name}`
              }
              role={
                stats
                  ? `Primar: ${stats.primarName} (${stats.primarPartid})`
                  : "Autoritate executivă locală"
              }
              icon={Building2}
              iconColor="#059669"
              contact={primarie}
              href={`/${judet}/autoritati`}
            />
            <AuthorityCard
              name={
                isBucharest ? "Prefectura București" : `Prefectura ${county.name}`
              }
              role="Reprezentantul Guvernului"
              icon={ShieldCheck}
              iconColor="#6366F1"
              contact={prefectura}
              href={`/${judet}/autoritati`}
            />
            <AuthorityCard
              name={
                isBucharest
                  ? "Poliția Locală București"
                  : `Poliția Locală ${county.name}`
              }
              role="Subordine primărie · 24/7"
              icon={UsersIcon}
              iconColor="#DC2626"
              contact={politialocala}
              href={`/${judet}/autoritati`}
            />
          </div>
        </div>
      </section>

      {/* ─── Primary actions grid ─── */}
      <section className="pb-8">
        <div className="container-narrow">
          <h2 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold mb-5">
            Acțiunile principale
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PRIMARY_SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.path}
                  href={`/${judet}${s.path}`}
                  prefetch={s.prefetch}
                  className="group relative overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 hover:border-[var(--color-primary)]/30 card-lift transition-all"
                >
                  <div
                    className="w-10 h-10 rounded-[var(--radius-xs)] flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${s.color}15`, color: s.color }}
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-bold group-hover:text-[var(--color-primary)] transition-colors">
                    {s.label}
                  </p>
                  <ArrowRight
                    size={12}
                    className="absolute top-4 right-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Secondary sections grid ─── */}
      <section className="py-6">
        <div className="container-narrow">
          <h2 className="font-[family-name:var(--font-sora)] text-base font-bold mb-4 text-[var(--color-text-muted)] uppercase tracking-wider">
            Tot despre {county.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {SECONDARY_SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.path}
                  href={`/${judet}${s.path}`}
                  className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-4 hover:border-[var(--color-primary)]/30 card-lift transition-all text-center"
                >
                  <div
                    className="w-9 h-9 rounded-[var(--radius-xs)] flex items-center justify-center mx-auto mb-2"
                    style={{ backgroundColor: `${s.color}15`, color: s.color }}
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </div>
                  <p className="text-xs font-semibold group-hover:text-[var(--color-primary)] transition-colors leading-tight">
                    {s.label}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="pb-14">
        <div className="container-narrow">
          <div className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-emerald-800 to-[#0a0a0a] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-8 md:p-12 text-white">
            <div
              className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(120,119,198,0.2),transparent)]"
              aria-hidden="true"
            />
            <div className="relative z-10 grid lg:grid-cols-[1fr_auto] items-center gap-6">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-100/90 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full backdrop-blur-sm mb-3">
                  <Megaphone size={10} aria-hidden="true" />
                  Pentru orice cetățean din {county.name}
                </p>
                <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-2 leading-tight">
                  Ai o problemă în {county.name}?
                </h2>
                <p className="text-emerald-100/80 leading-relaxed text-sm md:text-base max-w-xl">
                  Depune o sesizare formală — generăm textul cu temei legal,
                  detectăm autoritățile competente, tu doar apeși trimite.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href={`/${judet}/sesizari`}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-full)] bg-white text-[var(--color-primary)] font-semibold hover:bg-white/90 active:scale-[0.97] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700"
                >
                  <AlertCircle size={16} aria-hidden="true" />
                  Fă o sesizare
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
