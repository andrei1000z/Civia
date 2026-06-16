/** Tint semantic pentru un fix-score (0-100), dark-safe via tokeni. */
export function scoreTint(score: number): { color: string; bg: string; label: string } {
  if (score >= 60) return { color: "var(--color-success)", bg: "var(--color-success-soft)", label: "Bun" };
  if (score >= 30) return { color: "var(--color-warning)", bg: "var(--color-warning-soft)", label: "Mediu" };
  return { color: "var(--color-error)", bg: "var(--color-error-soft)", label: "Slab" };
}

/**
 * Vizual pentru rang — top 3 capătă o iconiță (Trophy/Medal/Award) cu tentă de
 * medalie (aur/argint/bronz), restul doar numărul. NU emoji 🥇 (nu e dark/brand-
 * safe, vezi convențiile). `iconKey` e mapat la lucide în componentă.
 */
export function rankInfo(rank: number): { iconKey: "trophy" | "medal" | "award" | null; tint: string } {
  if (rank === 1) return { iconKey: "trophy", tint: "text-amber-500" };
  if (rank === 2) return { iconKey: "medal", tint: "text-slate-400" };
  if (rank === 3) return { iconKey: "award", tint: "text-amber-700 dark:text-amber-600" };
  return { iconKey: null, tint: "text-[var(--color-text-muted)]" };
}
