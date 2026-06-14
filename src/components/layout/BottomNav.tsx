"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { NAV_MORE, SITE_NAME } from "@/lib/constants";
import { SearchModal } from "@/components/ui/SearchModal";
import { cn } from "@/lib/utils";

/**
 * BottomNav — navigația principală pe MOBIL, stil iOS 26/27 „liquid glass".
 * Bară flotantă jos (4: Sesizări · Știri · Petiții · Meniu) + un sheet animat
 * care se deschide DEASUPRA barei (nu full-screen) cu restul destinațiilor.
 *
 * Înlocuiește navbarul de sus pe mobil (Navbar.tsx e `hidden lg:block`). Pe
 * desktop bara asta e ascunsă (`lg:hidden`), rămâne navbarul clasic.
 *
 * Glass: `lc-glass-2` (blur 32px + saturate 200%, inset highlight). Animații
 * CSS (springy cubic-bezier) — fără framer-motion, ca restul codebase-ului.
 */

const SPRING = "cubic-bezier(0.34, 1.4, 0.5, 1)";

// Cele 3 destinații principale din bară (Meniu e al 4-lea, special).
const TABS = [
  { href: "/sesizari", label: "Sesizări", Icon: Send },
  { href: "/stiri", label: "Știri", Icon: Newspaper },
  { href: "/petitii", label: "Petiții", Icon: FileSignature },
] as const;

// Restul destinațiilor, în sheet. Proteste + Întreruperi (din NAV_LINKS) +
// NAV_MORE (Explorează). Toate sunt naționale → fără prefix de județ.
const SHEET_LINKS: Array<{ href: string; label: string; emoji?: string; Icon?: typeof Send }> = [
  { href: "/proteste", label: "Proteste", Icon: Megaphone },
  { href: "/intreruperi", label: "Întreruperi", Icon: Zap },
  ...NAV_MORE.map((l) => ({ href: l.href, label: l.label, emoji: l.icon })),
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const routeIndex = TABS.findIndex((t) => isActive(t.href));
  // Pastila se mută la tab-ul activ; pe „Meniu" cât e sheet-ul deschis.
  const pillIndex = open ? 3 : routeIndex;

  // Închide sheet-ul la schimbarea rutei.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock scroll + Escape cât e sheet-ul deschis.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Backdrop — apare doar cu sheet-ul deschis. */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Container fix jos: sheet (deasupra) + bară. pointer-events-none ca
          să nu blocheze tap-urile prin spațiile goale; copiii reactivează. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-[65] flex flex-col items-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)] pointer-events-none">

        {/* ===== SHEET ===== */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Meniu"
          aria-hidden={!open}
          className={cn(
            "pointer-events-auto w-full max-w-md mb-2.5 origin-bottom lc-glass-2 lc-glow-emerald rounded-[28px] overflow-hidden motion-reduce:!transition-none",
            open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95 pointer-events-none",
          )}
          // listăm toate proprietățile (transform pt. TW v3, translate+scale pt.
          // TW v4 care le pune ca proprietăți individuale) ca să gliseze sigur.
          style={{ transition: `transform 360ms ${SPRING}, translate 360ms ${SPRING}, scale 360ms ${SPRING}, opacity 280ms ease` }}
        >
          <div className="p-4 max-h-[64vh] overflow-y-auto overscroll-contain">
            {/* Header: brand + close */}
            <div className="flex items-center justify-between mb-3">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-[var(--radius-button)] bg-gradient-to-br from-[var(--color-primary)] to-emerald-900 grid place-items-center text-white font-[family-name:var(--font-sora)] font-semibold text-xl leading-none" aria-hidden="true">C</span>
                <span className="font-[family-name:var(--font-sora)] font-bold text-[15px] text-[var(--color-text)]">{SITE_NAME}</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide meniul"
                className="w-9 h-9 grid place-items-center rounded-full bg-[var(--color-surface)]/60 text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            {/* Search pill */}
            <button
              type="button"
              onClick={() => { setOpen(false); setSearchOpen(true); }}
              className="w-full h-11 mb-3 flex items-center gap-2.5 px-4 rounded-full bg-[var(--color-surface)]/55 border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm hover:bg-[var(--color-surface)]/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <SearchIcon size={16} aria-hidden="true" />
              Caută pe Civia…
            </button>

            {/* Grilă destinații */}
            <div className="grid grid-cols-3 gap-2">
              {SHEET_LINKS.map((l, i) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    style={{ transitionDelay: open ? `${60 + i * 28}ms` : "0ms" }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-2xl text-center transition-all duration-300 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                      open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                      active
                        ? "bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/30"
                        : "bg-[var(--color-surface)]/45 hover:bg-[var(--color-surface)]/70",
                    )}
                  >
                    <span className={cn("grid place-items-center", active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]")} aria-hidden="true">
                      {l.Icon ? <l.Icon size={20} /> : <span className="text-xl leading-none">{l.emoji}</span>}
                    </span>
                    <span className="text-[11px] font-medium leading-tight text-[var(--color-text)]">{l.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Contul meu */}
            <Link
              href="/cont"
              onClick={() => setOpen(false)}
              className="mt-3 w-full h-11 flex items-center gap-2.5 px-4 rounded-full bg-[var(--color-surface)]/55 border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium hover:bg-[var(--color-surface)]/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <User size={16} aria-hidden="true" />
              Contul meu
            </Link>
          </div>
        </div>

        {/* ===== BARĂ ===== */}
        <nav
          aria-label="Navigare"
          className="pointer-events-auto relative w-full max-w-md h-[62px] lc-glass-2 rounded-full grid grid-cols-4 px-1.5"
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
              transition: `transform 380ms ${SPRING}, opacity 200ms ease`,
            }}
          />
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full transition-transform active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <t.Icon
                  size={21}
                  className={cn("transition-colors duration-300", active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}
                  aria-hidden="true"
                />
                <span className={cn("text-[10px] font-semibold leading-none transition-colors duration-300", active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}>
                  {t.label}
                </span>
              </Link>
            );
          })}
          {/* Tab „Meniu" — al 4-lea slot, deschide sheet-ul. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Meniu"
            aria-expanded={open}
            aria-haspopup="dialog"
            className="relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full transition-transform active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <MenuIcon
              size={21}
              className={cn("transition-colors duration-300", open ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}
              aria-hidden="true"
            />
            <span className={cn("text-[10px] font-semibold leading-none transition-colors duration-300", open ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]")}>
              Meniu
            </span>
          </button>
        </nav>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
