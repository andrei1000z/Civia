"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Send,
  Newspaper,
  FileSignature,
  Menu as MenuIcon,
  Search as SearchIcon,
  Megaphone,
  Zap,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { SearchModal } from "@/components/ui/SearchModal";
import { cn } from "@/lib/utils";

/**
 * BottomNav — navigația principală pe MOBIL, stil iOS 26 „Liquid Glass".
 * Bară flotantă jos (4: Sesizări · Știri · Petiții · Meniu) + un sheet care se
 * deschide DEASUPRA barei cu restul destinațiilor. Înlocuiește navbarul de sus
 * pe mobil (Navbar.tsx e `hidden lg:block`); pe desktop bara asta e ascunsă.
 *
 * Material: `.lc-nav-glass` (opac cât trebuie pt. lizibilitate peste fundal
 * aglomerat + specular + rim + umbră). Animații CSS spring (transform/opacity =
 * 60fps), respectă reduced-motion. Bara se MINIMIZEAZĂ la scroll-down (iOS 26).
 */

// Spring catifelat (overshoot mic = clean, nu jucăuș) pt. sheet + pastilă.
const SPRING = "cubic-bezier(0.33, 1.28, 0.5, 1)";

type Tab = { href: string; label: string; Icon: LucideIcon };

// Cele 3 destinații principale (Meniu e al 4-lea, special).
const TABS: Tab[] = [
  { href: "/sesizari", label: "Sesizări", Icon: Send },
  { href: "/stiri", label: "Știri", Icon: Newspaper },
  { href: "/petitii", label: "Petiții", Icon: FileSignature },
];

// Restul destinațiilor, în sheet. Etichete SCURTE (1 cuvânt) ca să încapă pe un
// rând și grila să rămână aliniată (hrefs identice cu NAV_LINKS/NAV_MORE).
const SHEET_LINKS: Array<{ href: string; label: string; emoji?: string; Icon?: LucideIcon }> = [
  { href: "/proteste", label: "Proteste", Icon: Megaphone },
  { href: "/intreruperi", label: "Întreruperi", Icon: Zap },
  { href: "/provocari", label: "Provocare", emoji: "🎯" },
  { href: "/informatii-publice", label: "Info 544", emoji: "📨" },
  { href: "/promisometru", label: "Promisometru", emoji: "📊" },
  { href: "/bugetare-participativa", label: "Bugetare", emoji: "💶" },
  { href: "/ghiduri", label: "Ghiduri", emoji: "📚" },
  { href: "/propuneri-legislative", label: "Legislativ", emoji: "⚖️" },
  { href: "/clasament", label: "Clasament", emoji: "🏆" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // compact = bara minimizată (icon-only) la scroll-down; full la scroll-up/top.
  const [compact, setCompact] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastY = useRef(0);

  const isActive = (href: string) => {
    if (pathname === href || pathname.startsWith(href + "/")) return true;
    // variantă cu prefix de județ (ex: /cj/stiri) pentru tab-uri county-aware.
    const noCounty = pathname.replace(/^\/[a-z]{1,2}(?=\/)/, "");
    return noCounty === href || noCounty.startsWith(href + "/");
  };
  const routeIndex = TABS.findIndex((t) => isActive(t.href));
  const pillIndex = open ? 3 : routeIndex;

  // Închide sheet-ul la schimbarea rutei.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Minimizare la scroll-down (iOS 26 tab bar). Oprită cât e sheet-ul deschis.
  useEffect(() => {
    if (open) { setCompact(false); return; }
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (y < 48) setCompact(false);            // aproape de top → mereu full
        else if (dy > 6) setCompact(true);         // scroll-down clar → minimizat
        else if (dy < -6) setCompact(false);       // scroll-up clar → full
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  // Cât e sheet-ul deschis: lock scroll + Escape + FOCUS TRAP (focus pe primul
  // element, Tab ciclează în sheet, focus restaurat la închidere).
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

  return (
    <>
      {/* Backdrop — scrim întunecat (fundalul aglomerat dispare → un singur
          strat de sticlă citibil). Doar cu sheet-ul deschis. */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-[60] bg-black/45 backdrop-blur-[3px] transition-opacity duration-300 motion-reduce:transition-none",
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
                className="w-11 h-11 grid place-items-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[var(--color-text)] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-95 transition-[transform,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Search pill */}
            <button
              type="button"
              onClick={() => { setOpen(false); setSearchOpen(true); }}
              className="w-full h-11 mb-3 flex items-center gap-2.5 px-4 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[var(--color-text-muted)] text-sm hover:bg-black/[0.07] dark:hover:bg-white/[0.08] active:scale-[0.99] transition-[transform,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
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
                      "h-[78px] flex flex-col items-center justify-center gap-1.5 px-1.5 rounded-2xl text-center transition-[transform,opacity,background-color] duration-300 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] motion-reduce:!transition-none motion-reduce:!delay-0",
                      open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                      active
                        ? "bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/30"
                        : "bg-black/[0.035] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.07]",
                    )}
                  >
                    <span className={cn("grid place-items-center", active ? "text-[var(--color-primary-hover)] dark:text-[var(--color-primary)]" : "text-[var(--color-text)]")} aria-hidden="true">
                      {l.Icon ? <l.Icon size={21} strokeWidth={active ? 2.4 : 1.9} /> : <span className="text-xl leading-none">{l.emoji}</span>}
                    </span>
                    <span className="text-[11px] font-medium leading-tight text-[var(--color-text)] line-clamp-1">{l.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Contul meu */}
            <Link
              href="/cont"
              onClick={() => setOpen(false)}
              className="mt-3 w-full h-11 flex items-center gap-2.5 px-4 rounded-full bg-black/[0.04] dark:bg-white/[0.05] text-[var(--color-text)] text-sm font-medium hover:bg-black/[0.07] dark:hover:bg-white/[0.08] active:scale-[0.99] transition-[transform,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <User size={16} aria-hidden="true" />
              Contul meu
            </Link>
          </div>
        </div>

        {/* ===== BARĂ ===== */}
        <nav
          aria-label="Navigare"
          className={cn(
            "pointer-events-auto relative w-full max-w-md lc-nav-glass rounded-full grid grid-cols-4 px-1.5 transition-[height] duration-300 ease-out motion-reduce:transition-none",
            compact ? "h-[52px]" : "h-[64px]",
          )}
        >
          {/* Pastila activă — alunecă springy între cele 4 sloturi. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1.5 bottom-1.5 left-1.5 rounded-full bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/25 motion-reduce:!transition-none",
              pillIndex < 0 && "opacity-0",
            )}
            style={{
              width: "calc(25% - 0.375rem)",
              transform: `translateX(calc(${Math.max(pillIndex, 0)} * (100% + 0.5rem)))`,
              transition: `transform 280ms ${SPRING}, opacity 200ms ease`,
            }}
          />
          {[...TABS, null].map((t, idx) => {
            const isMenu = t === null;
            const active = isMenu ? open : isActive(t!.href);
            const label = isMenu ? "Meniu" : t!.label;
            const Icon = isMenu ? MenuIcon : t!.Icon;
            const colorCls = active ? "text-[var(--color-primary-hover)] dark:text-[var(--color-primary)]" : "text-[var(--color-text-muted)]";
            const inner = (
              <>
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={cn("shrink-0 transition-[color,transform] duration-300 motion-reduce:!transition-none", colorCls, active && !compact && "scale-[1.06]")}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[10px] font-semibold leading-none transition-[color,opacity,max-height] duration-200 motion-reduce:!transition-none overflow-hidden",
                    colorCls,
                    compact ? "opacity-0 max-h-0" : "opacity-100 max-h-3",
                  )}
                >
                  {label}
                </span>
              </>
            );
            const cls = "relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full transition-transform active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";
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
