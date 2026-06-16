/**
 * Wilson score lower bound (interval de încredere binomial, 95%).
 *
 * Problema pe care o rezolvă: un fix-rate brut tratează „2 din 3 = 67%" mai sus
 * decât „44 din 80 = 55%", deși al doilea e MULT mai sigur. Pe un clasament de
 * autorități asta e nedrept (un oraș cu 3 sesizări sare peste unul cu 80).
 *
 * Wilson lower bound penalizează eșantioanele mici → folosit DOAR la SORTARE.
 * Numărul afișat rămâne fix-rate-ul brut familiar (resolved/total).
 *
 * Pur + determinist (zero I/O) → testabil cu Vitest.
 */
export function wilsonLowerBound(positive: number, total: number): number {
  if (total <= 0) return 0;
  if (positive < 0) positive = 0;
  if (positive > total) positive = total;
  const z = 1.96; // 95% CI
  const z2 = z * z;
  const p = positive / total;
  const denom = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return (center - margin) / denom;
}
