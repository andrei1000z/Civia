import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Delta — variație procentuală cu săgeată + semn. Colorblind-safe: săgeata ȘI
 * semnul +/− duc informația și fără culoare („culoarea nu e niciodată singurul
 * semnal"). `inverse` pentru metrici unde scăderea e bună (ex: timp de răspuns,
 * sesizări nerezolvate). Server-compatible (fără „use client").
 */
export function Delta({
  value,
  inverse = false,
  showZero = true,
  className,
}: {
  /** Variația în procente (ex: 12 = +12%, -8 = −8%). */
  value: number;
  /** true → scăderea e pozitivă (verde). */
  inverse?: boolean;
  /** false → nu randa nimic dacă value e 0. */
  showZero?: boolean;
  className?: string;
}) {
  if (value === 0 && !showZero) return null;
  const up = value > 0;
  const down = value < 0;
  const good = inverse ? down : up;
  const tone =
    value === 0
      ? "text-[var(--color-text-muted)]"
      : good
        ? "text-[var(--color-success)]"
        : "text-[var(--color-error)]";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        tone,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {up ? "+" : ""}
        {Math.round(value)}%
      </span>
      <span className="sr-only">
        {value === 0 ? "fără schimbare" : good ? "în bine" : "în rău"}
      </span>
    </span>
  );
}
