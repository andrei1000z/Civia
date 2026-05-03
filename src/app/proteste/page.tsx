import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Megaphone,
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  Pin,
  Plus,
} from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { ALL_COUNTIES } from "@/data/counties";

export const revalidate = 600; // 10 min — proteste rare, nu e nevoie de fresh

export const metadata: Metadata = {
  title: "Proteste programate",
  description:
    "Calendar de proteste, mitinguri și marșuri civice anunțate în România. Vezi cauza, locația, organizatorul și revendicările.",
  alternates: { canonical: "/proteste" },
};

interface Protest {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cause: string | null;
  description: string;
  start_at: string;
  end_at: string | null;
  location_name: string;
  city: string | null;
  county_slug: string | null;
  organizer: string | null;
  expected_attendance: number | null;
  status: "planificat" | "in_desfasurare" | "incheiat" | "anulat";
  featured: boolean;
  cover_image_url: string | null;
  external_url: string | null;
  hashtag: string | null;
  color_theme: string;
  tags: string[];
}

const STATUS_META: Record<
  Protest["status"],
  { label: string; chip: string; dot: string }
> = {
  planificat: {
    label: "Programat",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  in_desfasurare: {
    label: "În desfășurare",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dot: "bg-rose-500 motion-safe:animate-pulse",
  },
  incheiat: {
    label: "Încheiat",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    dot: "bg-slate-400",
  },
  anulat: {
    label: "Anulat",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
};

async function fetchProteste(): Promise<Protest[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("proteste")
      .select(
        "id,slug,title,subtitle,cause,description,start_at,end_at,location_name,city,county_slug,organizer,expected_attendance,status,featured,cover_image_url,external_url,hashtag,color_theme,tags",
      )
      .eq("visibility", "publica")
      .eq("moderation_status", "approved")
      .order("featured", { ascending: false })
      .order("start_at", { ascending: false });
    return (data ?? []) as Protest[];
  } catch {
    return [];
  }
}

function formatRoDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

function formatRoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
}

function countyLabel(slug: string | null): string | null {
  if (!slug) return null;
  return ALL_COUNTIES.find((c) => c.slug === slug)?.name ?? null;
}

export default async function ProtestePage() {
  const proteste = await fetchProteste();
  const upcoming = proteste.filter((p) => p.status === "planificat" || p.status === "in_desfasurare");
  const past = proteste.filter((p) => p.status === "incheiat" || p.status === "anulat");

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Proteste programate"
        icon={Megaphone}
        gradient={HERO_GRADIENT.warning}
        description={
          <>
            Calendar civic cu protestele, mitingurile și marșurile anunțate în
            România. Vezi <strong>cauza</strong>, locul, organizatorul și
            revendicările concrete — totul într-un singur loc.
          </>
        }
        tagline={
          proteste.length === 0
            ? "Nu sunt proteste anunțate în acest moment."
            : `${upcoming.length} ${upcoming.length === 1 ? "protest activ" : "proteste active"} · ${past.length} arhivate`
        }
      />

      {/* Submit CTA — sits right under the hero so people see it before
          they scroll through the list. The verified-by-admin promise is
          load-bearing trust copy. */}
      <div className="mb-8 bg-gradient-to-br from-[var(--color-primary)]/10 via-[var(--color-surface)] to-amber-500/5 border border-[var(--color-primary)]/30 rounded-[var(--radius-md)] p-4 md:p-5 flex items-start gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-[var(--radius-xs)] bg-[var(--color-primary)]/15 grid place-items-center shrink-0"
          aria-hidden="true"
        >
          <Plus size={18} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base mb-0.5">
            Cunoști un protest care nu e listat?
          </p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Trimite-l aici. Verificăm și publicăm de obicei în 24–48h.
          </p>
        </div>
        <Link
          href="/proteste/propune"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          <Plus size={14} aria-hidden="true" />
          Propune protest
        </Link>
      </div>

      {proteste.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-10">
              <h2 className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-extrabold mb-4 inline-flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full bg-rose-500 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                Active și viitoare
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {upcoming.map((p) => (
                  <ProtestCard key={p.id} p={p} />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="mb-10">
              <h2 className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-extrabold mb-4 text-[var(--color-text-muted)]">
                Arhivă
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 opacity-90">
                {past.map((p) => (
                  <ProtestCard key={p.id} p={p} muted />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="mt-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 text-sm text-[var(--color-text-muted)] leading-relaxed">
        <p className="font-semibold text-[var(--color-text)] mb-1.5 inline-flex items-center gap-1.5">
          <Pin size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
          Cum apar protestele aici?
        </p>
        <p>
          Listele se completează din două surse: echipa Civia adaugă protestele
          anunțate public (site-uri oficiale, ONG-uri, evenimente Facebook), iar
          oricine poate <Link href="/proteste/propune" className="text-[var(--color-primary)] hover:underline font-semibold">propune un protest</Link>{" "}
          care apoi e verificat manual înainte de publicare. Civia{" "}
          <strong>nu organizează</strong> protestele și nu poartă responsabilitate
          pentru ce se întâmplă la ele.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] p-10 md:p-14 text-center">
      <div
        className="w-14 h-14 mx-auto mb-4 rounded-[var(--radius-md)] bg-amber-500/10 grid place-items-center"
        aria-hidden="true"
      >
        <Megaphone size={26} className="text-amber-600 dark:text-amber-400" />
      </div>
      <h2 className="font-[family-name:var(--font-sora)] font-bold text-lg md:text-xl mb-2">
        Nu sunt proteste anunțate momentan
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed">
        Pagina e pregătită — când va fi anunțat un protest sau un marș civic,
        apare aici cu data, locația, organizatorul și revendicările exacte.
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-4">
        Cunoști un protest care vine?{" "}
        <Link href="/proteste/propune" className="text-[var(--color-primary)] hover:underline font-semibold">
          Trimite-l aici
        </Link>
        . Sau vezi <Link href="/petitii" className="text-[var(--color-primary)] hover:underline">petițiile civice</Link>.
      </p>
    </div>
  );
}

function ProtestCard({ p, muted = false }: { p: Protest; muted?: boolean }) {
  const status = STATUS_META[p.status];
  const county = countyLabel(p.county_slug);
  return (
    <li>
      <Link
        href={`/proteste/${p.slug}`}
        className="group block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-2)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        {p.cover_image_url ? (
          <div className="relative aspect-[16/9] bg-[var(--color-surface-2)]">
            <Image
              src={p.cover_image_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className={`object-cover transition-transform group-hover:scale-105 ${muted ? "opacity-70 saturate-50" : ""}`}
            />
            {p.featured && (
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                Featured
              </span>
            )}
            <span
              className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-pill)] border text-[10px] font-semibold backdrop-blur-sm bg-white/80 dark:bg-black/50 ${status.chip}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
          </div>
        ) : (
          <div className="px-5 pt-4 flex items-center justify-between gap-2">
            {p.featured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-[10px] font-bold uppercase tracking-wider">
                Featured
              </span>
            )}
            <span
              className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-pill)] border text-[10px] font-semibold ${status.chip}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
          </div>
        )}

        <div className="p-5">
          {p.cause && (
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-primary)] mb-1.5">
              {p.cause}
            </p>
          )}
          <h3 className="font-[family-name:var(--font-sora)] font-extrabold text-base md:text-lg leading-snug mb-1.5 group-hover:text-[var(--color-primary)] transition-colors">
            {p.title}
          </h3>
          {p.subtitle && (
            <p className="text-xs text-[var(--color-text-muted)] mb-3 line-clamp-2 leading-relaxed">
              {p.subtitle}
            </p>
          )}

          <dl className="grid grid-cols-1 gap-1.5 text-xs">
            <div className="flex items-start gap-2">
              <Calendar size={13} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-[var(--color-text)]">{formatRoDateTime(p.start_at)}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-[var(--color-text)]">
                {p.location_name}
                {county && <span className="text-[var(--color-text-muted)]"> · {county}</span>}
              </span>
            </div>
            {p.expected_attendance != null && (
              <div className="flex items-start gap-2">
                <Users size={13} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-[var(--color-text)]">
                  ~{p.expected_attendance.toLocaleString("ro-RO")} estimat
                </span>
              </div>
            )}
          </dl>

          {(p.tags.length > 0 || p.hashtag) && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--color-border)]">
              {p.hashtag && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-mono font-semibold">
                  {p.hashtag.startsWith("#") ? p.hashtag : `#${p.hashtag}`}
                </span>
              )}
              {p.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-[10px]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
      {/* External event link surfaced outside the main card so it doesn't
          fight the primary „vezi detalii" affordance. */}
      {p.external_url && (
        <div className="mt-1.5 px-1">
          <a
            href={p.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ExternalLink size={9} aria-hidden="true" />
            Eveniment oficial · {formatRoDate(p.start_at)}
          </a>
        </div>
      )}
    </li>
  );
}
