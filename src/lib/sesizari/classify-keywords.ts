/**
 * Override-uri DETERMINISTE pentru clasificarea tipului de sesizare — pentru
 * semnalele clare și ușor de confundat de modelul 8b. Rulează ÎNAINTE de AI;
 * dacă întoarce un tip, sărim apelul AI (rapid + 100% sigur). Restul → AI.
 *
 * Bug raportat (2026-06-19): „mașinile ocupă trotuarul … să pună stâlpișori" era
 * clasificat „trotuar" (modelul prindea cuvântul „trotuar" ca LOC, nu defectul).
 * Cererea de stâlpișori anti-parcare e un semnal explicit → „stalpisori".
 */
export function deterministicTip(text: string): string | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cereStalpisori = /(stalpisor|stalpi\s*anti|bolar|bollard)/.test(t);
  // Stâlpișorii anti-parcare există DOAR pe trotuar; un „gard pe linie tramvai"
  // e infrastructură de transport, nu stâlpișori.
  const eTramvai = /(tramvai|cale\s*ferata|\bsine\b|\blinia\s*\d)/.test(t);
  if (cereStalpisori && !eTramvai) return "stalpisori";
  return null;
}
