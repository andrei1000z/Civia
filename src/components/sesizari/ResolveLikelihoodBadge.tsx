import { Sparkles } from "lucide-react";
import { predictResolveLikelihood } from "@/lib/sesizari/response-rate";

interface Props {
  county: string | null;
  tip: string;
}

/**
 * Server component — afiseaza un badge cu probabilitatea ca o sesizare sa
 * fie rezolvata, calculata pe baza istoricului acelui judet + tip.
 * Heuristic — nu ML — dar e transparenta („baseline X% rezolvate + bonus Y").
 */
export async function ResolveLikelihoodBadge({ county, tip }: Props) {
  const { likelihood, label, sample } = await predictResolveLikelihood(county, tip);
  if (sample < 5) return null;

  const color =
    label === "high" ? "#059669"
    : label === "medium" ? "#f59e0b"
    : "#dc2626";

  const text =
    label === "high"
      ? `Sesizarile similare in zona se rezolva ~${likelihood}% din timp`
      : label === "medium"
        ? `Sansa medie de raspuns: ~${likelihood}% (din ${sample} sesizari)`
        : `Aceasta autoritate raspunde rar la acest tip (~${likelihood}%)`;

  return (
    <div
      className="inline-flex items-start gap-2 px-3 py-2 rounded-[var(--radius-xs)] text-xs"
      style={{ background: color + "15", border: `1px solid ${color}40`, color }}
    >
      <Sparkles size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
