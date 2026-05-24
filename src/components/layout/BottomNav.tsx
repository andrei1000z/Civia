"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Megaphone, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 2026-05-24 Faza 3 MINIMALISM — Bottom-nav mobile 4 tabs sticky.
 *
 * Adresează feedback persona Maria (2.5/5) + Cristian (2.6/5) — „prea
 * multe link-uri, mă pierd". Bottom-nav garantează 4 destinații primare
 * mereu accesibile la un singur tap, fără să deschizi hamburger.
 *
 * Hidden:
 *   - desktop (lg+) — navbar deja vizibil
 *   - /admin/* — staff context separat
 *   - /auth/* — login flow
 *   - când mobile menu hamburger e open (z-index)
 *
 * Spațiul de sub conținut (pb-16 pe body) e gestionat de layout.tsx când
 * BottomNav e montat.
 */

const TABS = [
  { href: "/", icon: Home, label: "Acasă" },
  { href: "/sesizari", icon: FileText, label: "Sesizări" },
  { href: "/petitii", icon: Megaphone, label: "Petiții" },
  { href: "/cont", icon: User, label: "Profil" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    /\/sesizari\/[^/]+$/.test(pathname); // hide on sesizare detail (long content)

  if (hidden) return null;

  return (
    <nav
      aria-label="Navigare principală mobilă"
      data-floating
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 lc-glass-1 border-t border-[var(--glass-border)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          // Active = exact match sau prefix match (e.g. /sesizari pentru /sesizari/00048)
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-14 min-h-[44px] text-[10px] font-medium transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]",
                  active
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
