import Link from "next/link";
import { ArrowLeft, MapPin, Sparkles, type LucideIcon } from "lucide-react";

export const COUNTY_HERO_GRADIENT = {
  /** Default emerald → indigo. Action / generic surfaces. */
  primary: "from-[var(--color-primary)] via-emerald-700 to-indigo-800",
  /** News-flavored — sky blue. */
  news: "from-sky-600 via-sky-700 to-indigo-800",
  /** Authority / institutional — slate-violet. */
  authority: "from-slate-700 via-violet-800 to-indigo-900",
  /** Civic events / transit — amber-orange. */
  events: "from-amber-600 via-orange-600 to-rose-700",
  /** Tickets / transport — orange. */
  transport: "from-orange-600 via-orange-700 to-rose-800",
  /** Outages / warnings — amber. */
  warning: "from-amber-600 via-orange-700 to-red-800",
  /** Historical / archival — indigo. */
  history: "from-indigo-700 via-indigo-800 to-slate-900",
  /** Health — red-rose. */
  health: "from-rose-600 via-red-700 to-red-900",
} as const;

interface CountyPageHeroProps {
  countyName: string;
  countyId: string;
  countySlug: string;
  /** Page title shown big — without the county name. The county name
   *  is auto-appended in a styled chip below. */
  title: string;
  /** One-paragraph lead. Plain string or rich JSX (for `<strong>`). */
  description?: React.ReactNode;
  /** Lucide icon shown in the white chip on the left. */
  icon: LucideIcon;
  /** Tailwind gradient classes. Pick from `COUNTY_HERO_GRADIENT.*`. */
  gradient?: string;
  /** Optional Sparkles tagline below the description. */
  tagline?: React.ReactNode;
  /** Slot for extra content (counters, CTAs, badges). */
  children?: React.ReactNode;
}

/**
 * Standard hero for `/[judet]/<page>` surfaces. Mirrors `PageHero` but
 * adds a built-in „Înapoi la {county}" link back to the county home,
 * a county code chip, and pre-tuned gradient presets so every county
 * page feels like the same product.
 *
 * The icon chip lives on the left, the county code chip top-right, and
 * the description / tagline / children slot reuses the same structure
 * as `PageHero`. Drop-in for any page with a flat `<h1>` header.
 */
export function CountyPageHero({
  countyName,
  countyId,
  countySlug,
  title,
  description,
  icon: Icon,
  gradient = COUNTY_HERO_GRADIENT.primary,
  tagline,
  children,
}: CountyPageHeroProps) {
  return (
    <header className="mb-8">
      <Link
        href={`/${countySlug}`}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        <ArrowLeft size={12} aria-hidden="true" />
        Înapoi la {countyName}
      </Link>

      <div
        className={`relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br ${gradient} text-white shadow-[var(--shadow-3)] p-6 md:p-7`}
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(255,255,255,0.18),transparent)]"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-11 h-11 rounded-[var(--radius-xs)] bg-white/15 backdrop-blur-sm border border-white/25 grid place-items-center shrink-0"
                aria-hidden="true"
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-white/80 mb-1.5">
                  <MapPin size={10} aria-hidden="true" />
                  {countyName}
                </p>
                <h1 className="font-[family-name:var(--font-sora)] text-2xl md:text-4xl font-extrabold leading-tight break-words">
                  {title}
                </h1>
              </div>
            </div>
            <span
              className="text-[11px] font-bold tracking-wider bg-white/15 backdrop-blur-sm border border-white/25 px-2.5 py-1 rounded-full tabular-nums shrink-0"
              aria-hidden="true"
            >
              {countyId}
            </span>
          </div>

          {description && (
            <p className="text-white/85 max-w-2xl leading-relaxed text-sm md:text-base mb-3 break-words">
              {description}
            </p>
          )}

          {tagline && (
            <p className="inline-flex items-start gap-1.5 text-xs text-white/75 leading-relaxed break-words">
              <Sparkles size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{tagline}</span>
            </p>
          )}

          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </header>
  );
}
