import { DEFAULT_BUGET_DISTRIBUTION } from "./calculator";

/**
 * „Tu împarți bugetul" — logica pură a simulatorului (FAZA 4, designul
 * educațional din research). Mecanica „commit-then-reveal": utilizatorul
 * alocă procente pe categorii FĂRĂ să vadă alocarea reală, apoi reveal +
 * comparație. Procentele reale: distribuția tipică a bugetului unei
 * primării de capitală (2024) din lib/buget/calculator.
 */

export interface CategorieSimulator {
  key: string;
  label: string;
  emoji: string;
  /** Alocarea reală, în procente întregi (suma = 100). */
  realPct: number;
}

export function getCategoriiSimulator(): CategorieSimulator[] {
  return DEFAULT_BUGET_DISTRIBUTION.map((c) => ({
    key: c.key,
    label: c.label,
    emoji: c.emoji,
    realPct: Math.round(c.share * 100),
  }));
}

export interface RezultatComparatie {
  perCategorie: Array<CategorieSimulator & { userPct: number; delta: number }>;
  /** Similaritate 0-100: 100 = identic cu bugetul real (100 - Σ|delta|/2). */
  similaritate: number;
  /** Categoria cu cea mai mare diferență absolută (cârligul de acțiune). */
  ceaMaiMareDiferenta: (CategorieSimulator & { userPct: number; delta: number }) | null;
}

export function compara(
  user: Record<string, number>,
  categorii: CategorieSimulator[] = getCategoriiSimulator(),
): RezultatComparatie {
  const perCategorie = categorii.map((c) => {
    const userPct = Math.max(0, Math.round(user[c.key] ?? 0));
    return { ...c, userPct, delta: userPct - c.realPct };
  });
  const sumAbs = perCategorie.reduce((s, c) => s + Math.abs(c.delta), 0);
  const similaritate = Math.max(0, Math.round(100 - sumAbs / 2));
  const ceaMaiMareDiferenta =
    [...perCategorie].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] ?? null;
  return { perCategorie, similaritate, ceaMaiMareDiferenta };
}

/** Scalează alocările utilizatorului la sumă exact 100 (buton „echilibrează").
 *  Toate zero → distribuție uniformă. Reziduul de rotunjire merge la cea mai mare. */
export function echilibreazaLa100(user: Record<string, number>, keys: string[]): Record<string, number> {
  const total = keys.reduce((s, k) => s + Math.max(0, user[k] ?? 0), 0);
  if (total === 0) {
    const equal = Math.floor(100 / keys.length);
    const out: Record<string, number> = {};
    keys.forEach((k, i) => { out[k] = equal + (i === 0 ? 100 - equal * keys.length : 0); });
    return out;
  }
  const out: Record<string, number> = {};
  let sum = 0;
  for (const k of keys) {
    out[k] = Math.round(((user[k] ?? 0) / total) * 100);
    sum += out[k];
  }
  // corectează reziduul de rotunjire pe categoria cu valoarea maximă
  const maxKey = keys.reduce((a, b) => ((out[a] ?? 0) >= (out[b] ?? 0) ? a : b));
  out[maxKey] = (out[maxKey] ?? 0) + (100 - sum);
  return out;
}

/** Textul de share (cârligul viral): diferența personală cea mai mare. */
export function shareText(r: RezultatComparatie): string {
  const d = r.ceaMaiMareDiferenta;
  if (!d || d.delta === 0) return `Am împărțit bugetul orașului ${r.similaritate}% la fel ca primăria. Tu cum l-ai împărți? civia.ro/bugetare-participativa/simulator`;
  const verb = d.delta > 0 ? "aș da mai mult" : "aș da mai puțin";
  return `Eu ${verb} pe ${d.label.toLowerCase()}: ${d.userPct}% vs ${d.realPct}% cât alocă primăria. Tu cum ai împărți bugetul? civia.ro/bugetare-participativa/simulator`;
}
