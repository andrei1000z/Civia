/**
 * 🚀 BIG #4 — Buget „Pe banii MEI" calculator.
 *
 * Calcul contributii fiscale RO 2026 din salariu brut sau net.
 * Apoi distribuie pe categorii cheltuieli primarie locala.
 *
 * Surse:
 *   - Codul Fiscal RO 2026 (rate fixe)
 *   - data.gov.ro / ANAF pentru distributii buget primarii
 */

export interface TaxBreakdown {
  salary_net_monthly: number;
  salary_gross_monthly: number;
  /** Impozit pe venit 10% pe brut dupa deducerile CAS+CASS */
  income_tax_monthly: number;
  /** CAS (asigurari sociale) 25% pe brut */
  cas_monthly: number;
  /** CASS (sanatate) 10% pe brut */
  cass_monthly: number;
  /** TVA estimat 7% pe net (estimare consum tipic 70% net) */
  vat_estimated_monthly: number;
  /** Total taxe lunare */
  total_taxes_monthly: number;
  /** Total taxe anuale */
  total_taxes_yearly: number;
  /** Cota la primarie locala (estimare 18% din impozit + 50% din TVA local) */
  primarie_share_yearly: number;
}

/**
 * Calculează taxele dintr-un salariu net lunar.
 * Folosește valori 2026: CAS 25%, CASS 10%, Impozit 10%, TVA 19% medie.
 */
export function calculateFromNet(salaryNetMonthly: number): TaxBreakdown {
  // Pentru a obtine brutul din net 2026 (Romania):
  // net = brut - CAS(25%) - CASS(10%) - impozit(10% pe brut dupa CAS+CASS)
  // → brut = net / (1 - 0.25 - 0.10 - 0.10 * 0.65) = net / 0.585
  const grossMonthly = salaryNetMonthly / 0.585;
  const cas = grossMonthly * 0.25;
  const cass = grossMonthly * 0.10;
  const incomeTaxBase = grossMonthly - cas - cass;
  const incomeTax = incomeTaxBase * 0.10;

  // TVA estimare: presupunem 65% din net cheltuit pe bunuri cu TVA 19% medie
  // (jumatate alimente TVA 9%, restul TVA 19% → medie ponderata ~7% pe net)
  const vatEstimated = salaryNetMonthly * 0.07;

  const totalMonthly = cas + cass + incomeTax + vatEstimated;
  const totalYearly = totalMonthly * 12;

  // Cota primarie locala: ~28% din impozit + ~12% din TVA (estimare medie)
  const primarieShareYearly =
    (incomeTax * 12) * 0.28 + (vatEstimated * 12) * 0.12;

  return {
    salary_net_monthly: salaryNetMonthly,
    salary_gross_monthly: Math.round(grossMonthly),
    income_tax_monthly: Math.round(incomeTax),
    cas_monthly: Math.round(cas),
    cass_monthly: Math.round(cass),
    vat_estimated_monthly: Math.round(vatEstimated),
    total_taxes_monthly: Math.round(totalMonthly),
    total_taxes_yearly: Math.round(totalYearly),
    primarie_share_yearly: Math.round(primarieShareYearly),
  };
}

/**
 * Distribuie cota primaria pe categorii de cheltuieli.
 * Bazat pe procente tipice buget primarie capitala 2024:
 *   Salarizare admin 25%, Intretinere 12%, Investitii 18%, Invatamant 15%,
 *   Sanatate 8%, Cultura 5%, Politie locala 6%, Salubrizare 7%, Alte 4%
 */
export interface BugetCategory {
  key: string;
  label: string;
  emoji: string;
  share_pct: number;
  amount_lei: number;
}

// 2026-06-12 — exportat pentru simulatorul „Tu împarți bugetul" (/bugetare-participativa/simulator).
export const DEFAULT_BUGET_DISTRIBUTION: Array<{ key: string; label: string; emoji: string; share: number }> = [
  { key: "salarizare", label: "Salarizare angajați primărie", emoji: "👔", share: 0.25 },
  { key: "investitii", label: "Investiții (asfaltări, lucrări)", emoji: "🏗️", share: 0.18 },
  { key: "invatamant", label: "Învățământ (școli, grădinițe)", emoji: "🎓", share: 0.15 },
  { key: "intretinere", label: "Întreținere clădiri publice", emoji: "🏛️", share: 0.12 },
  { key: "sanatate", label: "Sănătate", emoji: "🏥", share: 0.08 },
  { key: "salubrizare", label: "Salubrizare", emoji: "♻️", share: 0.07 },
  { key: "politia_locala", label: "Poliția locală", emoji: "🚓", share: 0.06 },
  { key: "cultura", label: "Cultură & sport", emoji: "🎭", share: 0.05 },
  { key: "alte", label: "Alte cheltuieli", emoji: "📊", share: 0.04 },
];

export function distributeToCategories(primarieShareYearly: number): BugetCategory[] {
  return DEFAULT_BUGET_DISTRIBUTION.map((c) => ({
    key: c.key,
    label: c.label,
    emoji: c.emoji,
    share_pct: Math.round(c.share * 100 * 10) / 10,
    amount_lei: Math.round(primarieShareYearly * c.share),
  }));
}
