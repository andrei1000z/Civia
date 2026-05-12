import Link from "next/link";
import { ArrowLeft, Sparkles, type LucideIcon } from "lucide-react";

interface PageHeroProps {
  /** Main page heading. Rendered as h1. */
  title: string;
  /** One-paragraph lead. Plain string or rich JSX (for `<strong>`). */
  description?: React.ReactNode;
  /** Lucide icon shown in the white chip on the left. */
  icon: LucideIcon;
  /** Tailwind gradient classes for the hero background. Pick a preset
   *  via GRADIENT.* or pass custom "from-X via-Y to-Z" classes. */
  gradient?: string;
  /** Optional Sparkles tagline below the description. */
  tagline?: React.ReactNode;
  /** Optional back-link rendered above the hero. */
  backHref?: string;
  backLabel?: string;
  /** Slot for extra content inside the hero (counters, badges, …). */
  children?: React.ReactNode;
}

/**
 * Brand-consistent page hero used across Civia surfaces. Same shape as
 * /admin, /cont, /sesizari/[code], /petitii, /stiri etc.
 */
export const HERO_GRADIENT = {
  /** Default — emerald → indigo. Action surfaces. */
  primary: "from-[var(--color-primary)] via-emerald-700 to-indigo-800",
  /** Civic petitions — purple. */
  petition: "from-purple-600 via-purple-700 to-indigo-900",
  /** News — slate informational. */
  news: "from-slate-700 via-slate-800 to-indigo-900",
  /** Success — emerald-teal. */
  success: "from-emerald-600 via-emerald-700 to-teal-800",
  /** Warning — amber. Use for alerts / interruption pages. */
  warning: "from-amber-600 via-orange-700 to-rose-800",
  /** Data — sky-blue analytical. */
  data: "from-sky-600 via-sky-700 to-indigo-800",
  /** Civic / authority — slate-purple, formal. */
  authority: "from-slate-700 via-purple-800 to-indigo-900",
  /** Health / wellness — teal. */
  health: "from-teal-600 via-teal-700 to-cyan-800",
} as const;

export function PageHero({
  title,
  description,
  icon: Icon,
  gradient = HERO_GRADIENT.primary,
  tagline,
  backHref,
  backLabel,
  children,
}: PageHeroProps) {
  return (
    <>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          {backLabel ?? "Înapoi"}
        </Link>
      )}
      <header
        className={`relative mb-8 overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br ${gradient} p-4 sm:p-6 md:p-8 text-white shadow-[var(--shadow-3)]`}
      >
        <div
          className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 -left-8 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        {/* SVG grain — subtle film texture that prevents the gradient
            from looking flat on big monitors. Inline data URI so no
            extra request, and `mix-blend-overlay` keeps it perceptual
            rather than additive (no greying-out on dark gradients). */}
        <div
          className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-start gap-4 flex-wrap">
          {/* Liquid-glass icon chip — inset highlight + saturated blur dă
              senzație de „sticlă lichidă" (iOS 18 / Vision OS). Înlocuiește
              ring-2 cu inset shadow alb subtle care „prinde lumina" la marginea
              superioară. */}
          <div
            className="w-12 h-12 rounded-[var(--radius-xs)] bg-white/15 grid place-items-center shrink-0"
            style={{
              backdropFilter: "blur(12px) saturate(180%)",
              WebkitBackdropFilter: "blur(12px) saturate(180%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.15)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
            aria-hidden="true"
          >
            <Icon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-sora)] text-xl sm:text-2xl md:text-4xl font-extrabold leading-tight mb-2 break-words">
              {title}
            </h1>
            {description && (
              <div className="text-sm md:text-base text-white/85 leading-relaxed max-w-2xl break-words">
                {description}
              </div>
            )}
            {tagline && (
              <p className="text-[11px] text-white/70 mt-3 inline-flex flex-wrap items-start gap-1.5 break-words">
                <Sparkles size={11} aria-hidden="true" className="shrink-0 mt-0.5" />
                <span>{tagline}</span>
              </p>
            )}
            {children}
          </div>
        </div>
      </header>
    </>
  );
}
