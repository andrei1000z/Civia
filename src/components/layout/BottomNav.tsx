"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Send,
  FileSignature,
  Menu as MenuIcon,
  Search as SearchIcon,
  Megaphone,
  Zap,
  Settings,
  X,
  Target,
  Mail,
  BarChart3,
  Euro,
  BookOpen,
  Scale,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Code-split: SearchModal e gated de starea „open" → nu intră în bundle-ul
// principal. Se încarcă la primul tap pe search.
const SearchModal = dynamic(
  () => import("@/components/ui/SearchModal").then((m) => m.SearchModal),
  { ssr: false },
);

/**
 * BottomNav — navigația principală pe MOBIL, stil iOS 26 „Liquid Glass".
 * Bară flotantă jos (3: Sesizări · Petiții · Meniu) + sheet deasupra cu
 * restul destinațiilor. Înlocuiește navbarul de sus pe mobil; ascunsă pe desktop.
 *
 * Material: `.lc-nav-glass` (opac cât trebuie pt. lizibilitate + specular + rim).
 * Animații CSS spring (transform/opacity = 60fps), respectă reduced-motion. Bara
 * se MINIMIZEAZĂ la scroll-down (label colapsat via grid-template-rows, smooth).
 */

// Spring catifelat (overshoot ~12% = clean, nu jucăuș) pt. sheet + pastilă.
const SPRING = "cubic-bezier(0.33, 1.28, 0.5, 1)";

type Item = { href: string; label: string; Icon: LucideIcon };

// Cele 2 destinații principale (Meniu e al 3-lea, special).
const TABS: Item[] = [
  { href: "/sesizari", label: "Sesizări", Icon: Send },
  { href: "/petitii", label: "Petiții", Icon: FileSignature },
];

// Restul destinațiilor, în sheet. Etichete SCURTE (1 cuvânt) + icoane LUCIDE
// peste tot (monocrome, se colorează la activ — coerent cu bara). Hrefs = rutele
// reale din NAV_LINKS/NAV_MORE.
const SHEET_LINKS: Item[] = [
  { href: "/proteste", label: "Proteste", Icon: Megaphone },
  { href: "/intreruperi", label: "Întreruperi", Icon: Zap },
  { href: "/provocari", label: "Provocare", Icon: Target },
  { href: "/informatii-publice", label: "Info 544", Icon: Mail },
  { href: "/promisometru", label: "Promisometru", Icon: BarChart3 },
  { href: "/bugetare-participativa", label: "Bugetare", Icon: Euro },
  { href: "/ghiduri", label: "Ghiduri", Icon: BookOpen },
  { href: "/propuneri-legislative", label: "Legislativ", Icon: Scale },
  { href: "/clasament", label: "Clasament", Icon: Trophy },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // compact = bara minimizată (label colapsat) la scroll-down.
  const [compact, setCompact] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastY = useRef(0);
  const accum = useRef(0); // delta cumulat (histerezis anti-flicker)

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };
  const routeIndex = TABS.findIndex((t) => isActive(t.href));
  const pillIndex = open ? TABS.length : routeIndex;

  // Închide sheet-ul la schimbarea rutei.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Minimizare la scroll-down (iOS 26). Oprită cât e sheet-ul deschis ȘI la
  // prefers-reduced-motion (altfel bara ar sări în înălțime — exact ce evită
  // reduced-motion). Histerezis pe delta cumulat (24px) ca să nu pâlpâie la flick.
  useEffect(() => {
    if (open) { setCompact(false); return; }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCompact(false);
      return;
    }
    const y0 = window.scrollY;
    lastY.current = y0;
    accum.current = 0;
    setCompact(y0 >= 48); // reflectă imediat poziția reală (ex. după închiderea sheet-ului)
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        lastY.current = y;
        if (y < 48) { setCompact(false); accum.current = 0; ticking = false; return; }
        if ((dy > 0) !== (accum.current > 0)) accum.current = 0; // reset la schimbare de direcție
        accum.current += dy;
        if (accum.current > 24) { setCompact(true); accum.current = 24; }
        else if (accum.current < -24) { setCompact(false); accum.current = -24; }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  // Cât e sheet-ul deschis: lock scroll + Escape + FOCUS TRAP.
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("a[href],button:not([disabled])")?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
        if (f.length === 0) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open]);

  const activeColor = "text-[var(--color-primary-hover)] dark:text-[var(--color-primary)]";

  return (
    <>
      {/* Backdrop — scrim întunecat (fundalul aglomerat dispare → un singur
          strat de sticlă citibil). Doar cu sheet-ul deschis. */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-[3px] transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Container fix jos: sheet (deasupra) + bară. pointer-events-none ca să
          nu blocheze tap-urile prin spațiile goale; copiii reactivează. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-[65] flex flex-col items-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] pointer-events-none">

        {/* ===== SHEET ===== */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Meniu"
          inert={open ? undefined : true}
          className={cn(
            "pointer-events-auto w-full max-w-md mb-2.5 origin-bottom lc-nav-glass rounded-[28px] overflow-hidden motion-reduce:!transition-none",
            open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-5 scale-[0.97] pointer-events-none",
          )}
          style={{ transition: `transform 340ms ${SPRING}, translate 340ms ${SPRING}, scale 340ms ${SPRING}, opacity 240ms ease` }}
        >
          <div className="p-4 max-h-[64dvh] overflow-y-auto overscroll-contain">
            {/* Header: brand + close */}
            <div className="flex items-center justify-between mb-3">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 min-h-11 py-1">
                <span className="w-8 h-8 rounded-[var(--radius-button)] bg-gradient-to-br from-[var(--color-primary)] to-emerald-900 grid place-items-center text-white font-[family-name:var(--font-sora)] font-semibold text-xl leading-none" aria-hidden="true">C</span>
                <span className="font-[family-name:var(--font-sora)] font-bold text-[15px] text-[var(--color-text)]">{SITE_NAME}</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide meniul"
                className="w-11 h-11 grid place-items-center rounded-full bg-black/[0.05] dark:bg-white/[0.07] text-[var(--color-text)] hover:bg-black/[0.09] dark:hover:bg-white/[0.11] active:scale-95 transition-[scale,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Search pill */}
            <button
              type="button"
              onClick={() => { setOpen(false); setSearchOpen(true); }}
              className="w-full h-11 mb-3 flex items-center gap-2.5 px-4 rounded-full bg-black/[0.05] dark:bg-white/[0.06] text-[var(--color-text-muted)] text-sm hover:bg-black/[0.08] dark:hover:bg-white/[0.09] active:scale-[0.99] transition-[scale,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <SearchIcon size={16} aria-hidden="true" />
              Caută pe Civia…
            </button>

            {/* Grilă destinații — tile-uri cu înălțime FIXĂ + text centrat */}
            <div className="grid grid-cols-3 gap-2">
              {SHEET_LINKS.map((l, i) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    style={{ transitionDelay: open ? `${50 + i * 26}ms` : "0ms" }}
                    className={cn(
                      "h-[78px] flex flex-col items-center justify-center gap-1.5 px-1.5 rounded-2xl text-center transition-[translate,scale,opacity,background-color] duration-300 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] motion-reduce:!transition-none motion-reduce:!delay-0",
                      open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                      active
                        ? "bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/30"
                        : "bg-black/[0.04] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08]",
                    )}
                  >
                    <l.Icon size={21} strokeWidth={active ? 2.4 : 1.9} className={active ? activeColor : "text-[var(--color-text)]"} aria-hidden="true" />
                    <span className="text-[11px] font-medium leading-tight text-[var(--color-text)] line-clamp-1">{l.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Setări */}
            <Link
              href="/setari"
              onClick={() => setOpen(false)}
              className="mt-3 w-full h-11 flex items-center gap-2.5 px-4 rounded-full bg-black/[0.05] dark:bg-white/[0.06] text-[var(--color-text)] text-sm font-medium hover:bg-black/[0.08] dark:hover:bg-white/[0.09] active:scale-[0.99] transition-[scale,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <Settings size={16} aria-hidden="true" />
              Setări
            </Link>
          </div>
        </div>

        {/* ===== BARĂ ===== */}
        <nav
          aria-label="Navigare"
          className="pointer-events-auto relative w-full max-w-md lc-nav-glass rounded-full grid grid-cols-3 px-1.5"
        >
          {/* Pastila activă — o celulă lățime, alunecă springy între sloturi. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1.5 bottom-1.5 left-1.5 rounded-full bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/25 motion-reduce:!transition-none",
              pillIndex < 0 && "opacity-0",
            )}
            style={{
              width: "calc((100% - 0.75rem) / 3)",
              transform: `translateX(calc(${Math.max(pillIndex, 0)} * 100%))`,
              transition: `transform 280ms ${SPRING}, opacity 200ms ease`,
            }}
          />
          {[...TABS, null].map((t, idx) => {
            const isMenu = t === null;
            const active = isMenu ? open : isActive(t!.href);
            const label = isMenu ? "Meniu" : t!.label;
            const Icon = isMenu ? MenuIcon : t!.Icon;
            const colorCls = active ? activeColor : "text-[var(--color-text-muted)]";
            const inner = (
              <>
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={cn("shrink-0 transition-[color,scale] duration-300 motion-reduce:!transition-none", colorCls, active && "scale-[1.06]")}
                  aria-hidden="true"
                />
                {/* Label colapsabil via grid-template-rows (smooth, fără clamp). */}
                <span
                  className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:!transition-none"
                  style={{ gridTemplateRows: compact ? "0fr" : "1fr" }}
                >
                  <span className={cn("min-h-0 overflow-hidden text-[10px] font-semibold leading-none transition-colors duration-300 motion-reduce:!transition-none", colorCls)}>
                    {label}
                  </span>
                </span>
              </>
            );
            const cls = "relative z-10 flex flex-col items-center justify-center gap-1 py-2.5 rounded-full transition-[scale] active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";
            return isMenu ? (
              <button
                key="meniu"
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label="Meniu"
                aria-expanded={open}
                aria-haspopup="dialog"
                className={cls}
              >
                {inner}
              </button>
            ) : (
              <Link key={t!.href} href={t!.href} aria-current={active ? "page" : undefined} className={cls}>
                {inner}
              </Link>
            );
          })}
        </nav>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
