import type { CountyStats } from "@/data/statistici-judete";

export function aqiColor(aqi: number): string {
  if (aqi <= 50) return "#059669";
  if (aqi <= 100) return "#EAB308";
  if (aqi <= 150) return "#F97316";
  return "#DC2626";
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Bun";
  if (aqi <= 100) return "Moderat";
  if (aqi <= 150) return "Slab";
  return "Periculos";
}

interface Props {
  countyName: string;
  stats: CountyStats;
  /** "floating" = hero cards (white-on-glass for /[judet] hero, lg+ only).
   *  "grid"     = mobile/desktop grid cards (surface-on-bg). */
  variant: "floating" | "grid";
}

/**
 * Stat cards reutilizate pe /[judet] hero + mobile fallback. Înainte
 * exista drift — schimbarea câmpurilor în hero nu se reflecta automat
 * pe mobile. Acum un singur source of truth.
 */
export function CountyStatCards({ countyName, stats, variant }: Props) {
  if (variant === "floating") {
    return (
      <div className="hidden lg:flex flex-col gap-4 w-72">
        {/* AQI card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
          <p className="text-emerald-200/70 text-xs font-medium mb-1">Calitate aer</p>
          <p className="text-3xl font-bold tabular-nums" style={{ color: aqiColor(stats.aqiMediu) }}>
            AQI: {stats.aqiMediu} — {aqiLabel(stats.aqiMediu)}
          </p>
          <p className="text-emerald-200/60 text-xs mt-1">medie anuală ANPM</p>
        </div>

        {/* Primar card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
          <p className="text-emerald-200/70 text-xs font-medium mb-1">Primar {countyName}</p>
          <p className="text-xl font-bold">{stats.primarName}</p>
          <p className="text-emerald-200/60 text-xs mt-1">
            {stats.primarPartid} · {stats.populatie.toLocaleString("ro-RO")} loc.
          </p>
        </div>

        {/* Transport card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5">
          <p className="text-emerald-200/70 text-xs font-medium mb-1">Transport public</p>
          <p className="text-xl font-bold">{stats.transportPublicOperator}</p>
          <p className="text-emerald-400 text-xs mt-1">
            {stats.hasMetrou ? "Cu metrou · " : ""}
            {stats.spatiiVerziMpPerLocuitor} m² spații verzi/loc.
          </p>
        </div>
      </div>
    );
  }

  // variant === "grid"
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 sm:p-4">
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Calitate aer</p>
        <p className="text-2xl font-bold" style={{ color: aqiColor(stats.aqiMediu) }}>AQI {stats.aqiMediu}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{stats.aqiQuality}</p>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 sm:p-4">
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Populație</p>
        <p className="text-2xl font-bold tabular-nums">{stats.populatie.toLocaleString("ro-RO")}</p>
        <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {stats.suprafataKmp.toLocaleString("ro-RO")} km²
        </p>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 sm:p-4">
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Primar</p>
        <p className="text-sm font-bold truncate">{stats.primarName}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{stats.primarPartid}</p>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-3 sm:p-4">
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Transport</p>
        <p className="text-sm font-bold truncate">{stats.transportPublicOperator}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{stats.hasMetrou ? "Cu metrou" : "Fără metrou"}</p>
      </div>
    </div>
  );
}
