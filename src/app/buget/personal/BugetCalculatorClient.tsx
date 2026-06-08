"use client";

import { useState, useMemo } from "react";
import { calculateFromNet, distributeToCategories } from "@/lib/buget/calculator";

export function BugetCalculatorClient() {
  const [salary, setSalary] = useState<number>(5000);
  // audit fix: selectorul de județ a fost eliminat — calculatorul e NAȚIONAL
  // (calculateFromNet/distributeToCategories nu folosesc județul), deci alegerea
  // nu schimba nimic → inducea în eroare.
  const [showResults, setShowResults] = useState<boolean>(false);

  const breakdown = useMemo(() => calculateFromNet(salary), [salary]);
  const categories = useMemo(
    () => distributeToCategories(breakdown.primarie_share_yearly),
    [breakdown.primarie_share_yearly],
  );

  const formatLei = (n: number) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="mt-8">
      <form
        className="p-6 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          setShowResults(true);
        }}
      >
        <div>
          <label htmlFor="salary" className="block text-sm font-medium mb-1.5">
            Salariu net lunar (RON)
          </label>
          <input
            id="salary"
            type="number"
            min="1000"
            max="100000"
            step="100"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value) || 0)}
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>
        <button
          type="submit"
          className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Calculează
        </button>
      </form>

      {showResults && (
        <>
          {/* Top-level summary */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <SummaryCard label="Taxe lunare" value={formatLei(breakdown.total_taxes_monthly)} subtitle="(CAS + CASS + impozit + TVA estimat)" />
            <SummaryCard label="Taxe anuale" value={formatLei(breakdown.total_taxes_yearly)} subtitle="Din salariul tău net" highlight />
            <SummaryCard label="La primăria ta" value={formatLei(breakdown.primarie_share_yearly)} subtitle="Cota estimată pe an" highlight />
          </div>

          {/* Detalii taxe */}
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-3">📊 Detalii contribuții fiscale (lunare)</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <DetailRow label="Salariu brut estimat" value={formatLei(breakdown.salary_gross_monthly)} />
              <DetailRow label="CAS (pensii) — 25%" value={formatLei(breakdown.cas_monthly)} muted />
              <DetailRow label="CASS (sănătate) — 10%" value={formatLei(breakdown.cass_monthly)} muted />
              <DetailRow label="Impozit pe venit — 10%" value={formatLei(breakdown.income_tax_monthly)} muted />
              <DetailRow label="TVA estimat lunar" value={formatLei(breakdown.vat_estimated_monthly)} muted />
            </div>
          </section>

          {/* Distribuție categorii */}
          <section>
            <h2 className="text-lg font-bold mb-3">
              💸 Pe ce se cheltuie banii TĂI la primărie
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Estimare bazată pe distribuții tipice buget primării din România 2024.{" "}
              Cota ta anuală: <strong>{formatLei(breakdown.primarie_share_yearly)}</strong>.
            </p>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li
                  key={cat.key}
                  className="p-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">{cat.emoji}</span>
                      <span className="font-medium">{cat.label}</span>
                    </div>
                    <span className="font-bold tabular-nums">{formatLei(cat.amount_lei)}</span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-primary)]"
                      style={{ width: `${Math.min(100, cat.share_pct * 4)}%` }}
                      aria-label={`${cat.share_pct}% din total`}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {cat.share_pct}% din total
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-6 p-4 rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                ⚠️ <strong>Disclaimer</strong>: Aceste cifre sunt o estimare bazată pe distribuții tipice
                de buget primării 2024. Distribuția reală variază per primărie și an. Pentru date
                exacte, consultă <a className="underline" href="https://data.gov.ro" target="_blank" rel="noopener">data.gov.ro</a>{" "}
                și raportul anual al primăriei tale.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, subtitle, highlight = false }: { label: string; value: string; subtitle: string; highlight?: boolean }) {
  return (
    <div
      className={`p-5 rounded-[var(--radius-md)] border ${highlight ? "bg-[var(--color-primary-soft)] border-[var(--color-primary)]/30" : "bg-[var(--color-surface-2)] border-[var(--color-border)]"}`}
    >
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-[var(--color-primary)]" : ""}`}>{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{subtitle}</p>
    </div>
  );
}

function DetailRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`p-3 rounded-[var(--radius-xs)] border border-[var(--color-border)] flex items-center justify-between ${muted ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-2)]"}`}>
      <span className="text-sm">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
