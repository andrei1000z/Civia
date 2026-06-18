"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * 2026-06-18 — Primitive stil „Settings de telefon" (Samsung One UI / iOS).
 *
 * - Carduri rotunjite (rounded-3xl) care plutesc pe fundalul paginii, cu spațiu
 *   între ele (grupul nu pune gap — îl pune containerul: space-y-3/4).
 * - Fiecare rând are o iconiță CIRCULARĂ colorată (fill solid + glyph alb).
 * - Divider INSET: începe după iconiță (left-[70px]), ascuns pe ultimul rând.
 */

export function SettingsGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-3xl lc-glass-2", className)}>{children}</div>
  );
}

type RowBase = {
  icon?: React.ReactNode;
  /** clasă pt. cercul iconiței: fill solid + glyph alb, ex. "bg-blue-500 text-white" */
  iconClass?: string;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  right?: React.ReactNode;
  danger?: boolean;
  /** conținut sub label (input, descriere, control wide) */
  children?: React.ReactNode;
};

// Divider inset (after icon ~70px) + ascuns pe ultimul rând al grupului.
const ROW_BASE =
  "relative flex gap-3.5 px-4 min-h-[60px] after:content-[''] after:absolute after:left-[70px] after:right-0 after:bottom-0 after:h-px after:bg-[var(--color-border)] last:after:hidden";

function Glyph({
  icon,
  iconClass,
  className,
}: {
  icon?: React.ReactNode;
  iconClass?: string;
  className?: string;
}) {
  if (!icon) return null;
  return (
    <span
      className={cn(
        "shrink-0 w-10 h-10 rounded-full grid place-items-center [&>svg]:w-5 [&>svg]:h-5",
        // gloss subtil: highlight intern sus + lift jos → pile lucioase pe sticlă
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_2px_6px_-1px_rgba(0,0,0,0.22)]",
        iconClass ?? "bg-[var(--color-primary)] text-white",
        className,
      )}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

function Body({
  label,
  sublabel,
  danger,
  children,
}: Pick<RowBase, "label" | "sublabel" | "danger" | "children">) {
  return (
    <div className="flex-1 min-w-0 py-2.5">
      <div
        className={cn(
          "text-[15px] font-medium leading-snug",
          danger ? "text-[var(--color-error)]" : "text-[var(--color-text)]",
        )}
      >
        {label}
      </div>
      {sublabel && (
        <div className="text-[13px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{sublabel}</div>
      )}
      {children}
    </div>
  );
}

/** Rând static / cu conținut sub label (input, descriere). align="start" =
 *  iconița se aliniază cu label-ul (pentru rânduri înalte cu input dedesubt). */
export function SettingsRow({
  icon,
  iconClass,
  right,
  align = "center",
  ...body
}: RowBase & { align?: "center" | "start" }) {
  return (
    <div className={cn(ROW_BASE, align === "start" ? "items-start" : "items-center")}>
      <Glyph icon={icon} iconClass={iconClass} className={align === "start" ? "mt-2.5" : undefined} />
      <Body {...body} />
      {right != null && <div className="shrink-0 flex items-center self-center pl-1">{right}</div>}
    </div>
  );
}

/** Rând clicabil — link sau onClick (Samsung nu pune chevron pe rândurile principale). */
export function SettingsLinkRow({
  href,
  onClick,
  icon,
  iconClass,
  right,
  ...body
}: RowBase & { href?: string; onClick?: () => void }) {
  const cls = cn(
    ROW_BASE,
    // tentă translucidă subtilă (nu opacă) ca să nu „spargă" sticla pe hover/press
    "items-center w-full text-left hover:bg-black/[0.035] dark:hover:bg-white/[0.05] active:scale-[0.99] active:bg-black/[0.05] dark:active:bg-white/[0.07] transition-[transform,background-color] duration-200 ease-out",
    // focus vizibil REAL (WCAG 2.4.7) — outline inset (cardul e overflow-hidden)
    "focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)] focus-visible:bg-black/[0.035] dark:focus-visible:bg-white/[0.05]",
  );
  const inner = (
    <>
      <Glyph icon={icon} iconClass={iconClass} />
      <Body {...body} />
      {right != null && <div className="shrink-0 flex items-center pl-1">{right}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Card mare de profil (nume + sub-text la stânga, avatar la dreapta) — stil Samsung. */
export function SettingsProfileCard({
  name,
  sub,
  initial,
}: {
  name: string;
  sub?: string;
  initial: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-3xl lc-glass-2 p-4 sm:p-5">
      <div className="flex-1 min-w-0">
        <div className="text-xl sm:text-2xl font-bold text-[var(--color-text)] truncate">{name}</div>
        {sub && <div className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">{sub}</div>}
      </div>
      <div
        className="shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-indigo-600 grid place-items-center text-2xl font-bold text-white shadow-[var(--shadow-2)]"
        aria-hidden="true"
      >
        {initial}
      </div>
    </div>
  );
}

/** Titlu mic de secțiune (opțional) — Samsung de obicei NU îl pune; folosește rar. */
export function SettingsGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-4 pt-1 text-[13px] font-semibold text-[var(--color-text-muted)]">{children}</h2>
  );
}
