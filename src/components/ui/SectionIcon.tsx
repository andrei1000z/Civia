import { cn } from "@/lib/utils";

/**
 * 2026-06-19 — Iconiță de secțiune stil One UI / iOS Settings: cerc colorat mic
 * cu glyph, lângă titlul (h2) unei secțiuni. Același limbaj ca rândurile din
 * /setari, dus pe titlurile de conținut din tot site-ul. SUBTIL, nu pompos:
 * un singur icon per secțiune principală.
 *
 * Folosire:
 *   <h2 className="flex items-center gap-2.5 ...">
 *     <SectionIcon icon={<Bell size={16} />} className="bg-orange-500 text-white" />
 *     Notificări
 *   </h2>
 */
export function SectionIcon({
  icon,
  className,
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid place-items-center w-8 h-8 rounded-full shrink-0 [&>svg]:w-4 [&>svg]:h-4",
        // gloss subtil — pile lucioase, ca pe /setari
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_2px_6px_-1px_rgba(0,0,0,0.18)]",
        // fallback dacă nu se dă o culoare
        !className && "bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)]",
        className,
      )}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
