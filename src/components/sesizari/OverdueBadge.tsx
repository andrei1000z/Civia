import { AlarmClock } from "lucide-react";
import { evaluateOverdue } from "@/lib/sesizari/overdue";

interface Props {
  createdAt: string | Date;
  status: string;
  officialResponseAt: string | Date | null;
  /** „compact" = chip mic doar cu zile; „full" = chip + tooltip explicativ */
  variant?: "compact" | "full";
}

/**
 * Chip roșu vizibil pe orice sesizare care a depășit termenul de 30 zile
 * de la depunere fără răspuns oficial. OG 27/2002 art. 14.
 *
 * Returnează `null` dacă sesizarea NU e overdue — safe să o lași pe carduri,
 * apare automat doar unde contează.
 */
export function OverdueBadge({
  createdAt,
  status,
  officialResponseAt,
  variant = "compact",
}: Props) {
  const r = evaluateOverdue({
    created_at: createdAt,
    status,
    official_response_at: officialResponseAt,
  });

  if (!r.isOverdue) return null;

  const label = `Termen depășit · ${r.daysOverdue} ${r.daysOverdue === 1 ? "zi" : "zile"}`;
  const tooltip = `Sesizarea a fost depusă acum ${r.daysSinceFiled} zile. Termenul legal de răspuns (OG 27/2002 art. 14) e de 30 de zile.`;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 text-[10px] font-semibold uppercase tracking-wider"
      title={tooltip}
      aria-label={tooltip}
    >
      <AlarmClock size={10} aria-hidden="true" />
      {variant === "full" ? label : `+${r.daysOverdue}z termen`}
    </span>
  );
}
