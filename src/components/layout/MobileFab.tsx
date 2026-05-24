"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Plus, X, FileText, AlertTriangle } from "lucide-react";
import { useCountyOptional } from "@/lib/county-context";
import { ALL_COUNTIES } from "@/data/counties";

/**
 * Floating speed-dial — butonul primar „+" pe mobile. La apăsare se deschide
 * un mini-menu cu cele mai accesate acțiuni:
 *   — Fă sesizare (target principal)
 *   — Întreruperi
 *   — Autorități
 *   — Aer live
 *
 * La un nou click pe „+" (acum „✕") se închide. Apasă în afară → close
 * automat. Apare doar după scroll ca să nu acopere hero-ul.
 */
export function MobileFab() {
  const pathname = usePathname();
  const county = useCountyOptional();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pathSlug = pathname.match(/^\/([a-z]{1,2})(?:\/|$)/)?.[1] ?? null;
  const validated = pathSlug && ALL_COUNTIES.some((c) => c.slug === pathSlug) ? pathSlug : null;
  const countySlug = county?.slug ?? validated;
  const sesizariTarget = countySlug ? `/${countySlug}/sesizari` : "/sesizari";
  const intreruperiTarget = countySlug ? `/${countySlug}/intreruperi` : "/intreruperi";

  const hidden =
    /\/sesizari\/?$/.test(pathname) ||
    pathname === "/urmareste" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/cont");

  // Close menu on route change — setState în effect e intenționat (sync
  // pathname schimbare cu open=false).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Scroll threshold for visibility
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setVisible(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on outside click / tap
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, [open]);

  if (hidden) return null;

  // The 4 speed-dial entries — declared as data so we can stagger their
  // entrance animations cleanly. Order matters: top-of-stack appears
  // last (highest in the column), so the primary "Fă sesizare" is at
  // the bottom — closest to the thumb.
  const dialItems = [
    { href: intreruperiTarget, icon: <AlertTriangle size={16} />, label: "Întreruperi", bg: "bg-orange-500" },
    { href: sesizariTarget, icon: <FileText size={16} />, label: "Fă sesizare", bg: "bg-[var(--color-primary)]" },
  ];

  return (
    <>
      {/* Soft backdrop — appears when the dial is open. Tapping it
          closes the dial (matches OS speed-dial conventions). The
          z-index sits below the dial wrap (z-30 vs z-40) so the
          buttons stay clickable. */}
      <div
        className={`lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-md backdrop-saturate-150 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={wrapRef}
        data-floating
        className="lg:hidden fixed right-4 z-40"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" /* 2026-05-24: bottom-nav (h-14=3.5rem) e sub FAB, dar FAB-ul are deja 5rem offset care îl pune deasupra. */ }}
      >
        {/* Action items — stack vertically, stagger when opening so the
            chain feels responsive instead of all 4 popping at once. */}
        <div
          className={`absolute right-0 bottom-full mb-3 flex flex-col items-end gap-2 transition-all duration-200 ${
            open
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          role="menu"
          aria-hidden={!open}
        >
          {dialItems.map((item, i) => (
            <div
              key={item.label}
              className="transition-all duration-200"
              style={{
                transitionDelay: open ? `${i * 30}ms` : "0ms",
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <SpeedDialLink
                href={item.href}
                icon={item.icon}
                label={item.label}
                bg={item.bg}
              />
            </div>
          ))}
        </div>

        {/* Primary button: + / ✕ */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Închide meniul de acțiuni rapide" : "Deschide meniul de acțiuni rapide"}
          aria-expanded={open}
          aria-haspopup="menu"
          tabIndex={visible ? 0 : -1}
          className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-primary)] text-white font-semibold shadow-[var(--shadow-xl)] transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary)]/40 ${
            visible
              ? "translate-y-0 opacity-100"
              : "translate-y-20 opacity-0 pointer-events-none"
          } ${open ? "rotate-45" : ""}`}
        >
          {open ? <X size={22} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={22} strokeWidth={2.5} aria-hidden="true" />}
        </button>
      </div>
    </>
  );
}

function SpeedDialLink({
  href,
  icon,
  label,
  bg,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  bg: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full text-white font-medium text-sm shadow-lg ${bg} hover:brightness-110 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40`}
    >
      <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  );
}
