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
/**
 * Liquid Civic v2027 — gradient presets refreshed.
 * Duotone emerald + aqua (verde-albastru) for main, violet for premium.
 * Toate cu 3 stops (în loc de 4) pentru curb mai lin, mai modern.
 */
export const HERO_GRADIENT = {
  /** Default — emerald → aqua. Verde civic + albastru trust. */
  primary: "from-emerald-600 via-emerald-500 to-cyan-500",
  /** Civic petitions — violet premium. */
  petition: "from-violet-600 via-purple-600 to-indigo-700",
  /** News — slate informational. */
  news: "from-slate-700 via-slate-800 to-cyan-900",
  /** Success — emerald glow. */
  success: "from-emerald-500 via-emerald-600 to-teal-700",
  /** Warning — amber. Use for alerts / interruption pages. */
  warning: "from-amber-500 via-orange-600 to-rose-700",
  /** Data — sky-blue analytical, duotone with aqua. */
  data: "from-cyan-500 via-sky-600 to-indigo-700",
  /** Civic / authority — slate emerald, formal. */
  authority: "from-slate-700 via-emerald-800 to-emerald-900",
  /** Health / wellness — teal aqua. */
  health: "from-teal-500 via-cyan-600 to-emerald-700",
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
          // py-3 -my-2: zona de atingere ≥44px pe mobile (WCAG 2.5.5) fără să
          // schimbe layout-ul vizual (margin negativ compensează padding-ul).
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-5 py-3 -my-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          {backLabel ?? "Înapoi"}
        </Link>
      )}
      <header
        className={`relative mb-4 md:mb-8 overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br ${gradient} px-4 py-4 sm:p-6 md:p-8 text-white shadow-[var(--shadow-3)]`}
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
        <div className="relative flex items-start gap-3 sm:gap-4 flex-wrap">
          {/* Liquid-glass icon chip — inset highlight + saturated blur dă
              senzație de „sticlă lichidă" (iOS 18 / Vision OS). */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-xs)] bg-white/15 grid place-items-center shrink-0 animate-scale-in"
            style={{
              backdropFilter: "blur(12px) saturate(180%)",
              WebkitBackdropFilter: "blur(12px) saturate(180%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.15)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
            aria-hidden="true"
          >
            <Icon size={20} className="sm:hidden" />
            <Icon size={22} className="hidden sm:block" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-sora)] text-base sm:text-xl md:text-3xl font-extrabold leading-tight mb-1 sm:mb-2 break-words hero-enter-1">
              {title}
            </h1>
            {description && (
              <div className="text-[12px] sm:text-sm md:text-base text-white/85 leading-relaxed max-w-2xl break-words line-clamp-2 sm:line-clamp-none hero-enter-2">
                {description}
              </div>
            )}
            {tagline && (
              <p className="inline-flex text-[11px] text-white/70 mt-3 flex-wrap items-start gap-1.5 break-words hero-enter-3">
                <Sparkles size={11} aria-hidden="true" className="shrink-0 mt-0.5" />
                <span>{tagline}</span>
              </p>
            )}
            {children && <div className="hero-enter-3">{children}</div>}
          </div>
        </div>
      </header>
    </>
  );
}
