import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: string | Date, locale = "ro-RO"): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
}

/** Format scurt — „13 mai 2026" cu luna abreviată („mai", „ian"). */
export function formatDateShort(input: string | Date, locale = "ro-RO"): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  });
}

export function formatDateTime(input: string | Date, locale = "ro-RO"): string {
  const date = typeof input === "string" ? new Date(input) : input;
  // Timezone EXPLICIT → altfel server-ul Vercel (UTC) și browser-ul
  // (Europe/Bucharest) emit texte diferite → React hydration error
  // #418/#419. Logged 5 ori în analytics pe /stiri/[id] înainte de fix.
  return date.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

export function timeAgo(input: string | Date, locale = "ro-RO"): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;

  // Guard against future dates (clock skew / timezone issues)
  if (diff < 0) return "chiar acum";

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diff < 60) return rtf.format(-Math.round(diff), "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 604800) return rtf.format(-Math.round(diff / 86400), "day");
  if (diff < 2592000) return rtf.format(-Math.round(diff / 604800), "week");
  if (diff < 31536000) return rtf.format(-Math.round(diff / 2592000), "month");
  return rtf.format(-Math.round(diff / 31536000), "year");
}

export function formatCurrency(amount: number, currency = "RON"): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  // DETERMINIST (fix #418 latent): `Intl.NumberFormat("ro-RO")` alege separatorul
  // de mii în funcție de ICU/CLDR-ul runtime-ului — Node pe Vercel randează
  // „12.345" (punct), browserul cu CLDR nou randează „12 345" (narrow no-break
  // space) → text mismatch server↔client = React #418 în orice client component.
  // Formatăm manual: „." la mii + „," la zecimale (ro), identic peste tot.
  const neg = num < 0;
  const rounded = Math.round(Math.abs(num) * 1000) / 1000; // ≤3 zecimale, ca ICU
  const [intPart, decPart] = String(rounded).split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const out = decPart ? `${grouped},${decPart}` : grouped;
  return neg ? `-${out}` : out;
}

/** Format un număr cu 1-2 zecimale (ex: 596.5 → "596,5", 4.27 → "4,27").
 *  Folosit pe paginile de date publice unde toFixed() nu respecta locale-ul. */
export function formatDecimal(num: number, fractionDigits = 1): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

/** Format pentru luna+an din ISO "YYYY-MM" -> "Septembrie 2028". */
export function formatMonthYear(monthStr: string): string {
  const [yearStr, monthIdxStr] = monthStr.split("-");
  const idx = Number(monthIdxStr) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return monthStr;
  const date = new Date(Number(yearStr), idx, 1);
  return new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(date);
}

/** Format prescurtat pentru numere mari ("125 mii", "3,4 mil", "1,2 mld").
 *  Folosit pentru stat-uri unde precizia nu contează (homepage, OG images). */
export function formatCompact(num: number): string {
  if (num < 1_000) return formatNumber(Math.round(num));
  if (num < 1_000_000) return `${formatDecimal(num / 1_000, 0)} mii`;
  if (num < 1_000_000_000) return `${formatDecimal(num / 1_000_000, 1)} mil`;
  return `${formatDecimal(num / 1_000_000_000, 1)} mld`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    // Romanian diacritics BEFORE NFD (since NFD decomposes them)
    .replace(/[ăâ]/g, "a")
    .replace(/[î]/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    // Then strip any remaining combining marks (for other languages)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "…";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
