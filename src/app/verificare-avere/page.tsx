import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 🚀 BIG #9 — Verificare avere demnitari (ANI).
 *
 * Lista demnitari cu salt suspect de avere YoY > 50%.
 *
 * IMPORTANT: dispozitiv defamation — disclaimere clare „date oficiale ANI"
 * + right of reply pentru fiecare demnitar.
 */

export const metadata: Metadata = {
  title: "Verificare avere demnitari — Top salturi suspecte",
  description:
    "Analizăm declarațiile de avere oficiale ANI cu AI pentru a detecta salturi suspecte de avere între ani. Toate datele sunt oficiale și publice.",
  alternates: { canonical: "/verificare-avere" },
};

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface DemnitarRow {
  id: string;
  full_name: string;
  display_slug: string;
  position: string;
  institution: string | null;
  county: string | null;
  party: string | null;
  data_year: number;
  cash_lei: number | null;
  real_estate_count: number | null;
  income_total: number | null;
  suspicious_jump_pct: number | null;
  ai_summary: string | null;
}

export default async function VerificareAverePage() {
  const admin = createSupabaseAdmin();

  // Top 50 cu jump suspect > 50%
  const { data } = await admin
    .from("demnitari_avere")
    .select("id, full_name, display_slug, position, institution, county, party, data_year, cash_lei, real_estate_count, income_total, suspicious_jump_pct, ai_summary")
    .gt("suspicious_jump_pct", 50)
    .order("suspicious_jump_pct", { ascending: false })
    .limit(50);

  const items = (data ?? []) as DemnitarRow[];

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Verificare avere demnitari"
        icon={TrendingUp}
        gradient={HERO_GRADIENT.warning}
        description={
          <>
            Analizăm <strong>declarațiile oficiale ANI</strong> ale demnitarilor cu AI
            pentru a detecta salturi suspecte de avere între ani.
          </>
        }
        tagline="Date publice + pattern detection AI."
      />

      <div className="my-6 p-4 rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
        <p className="text-sm text-amber-900 dark:text-amber-200 mb-1">
          <AlertTriangle size={14} className="inline mr-1" aria-hidden="true" />
          <strong>Disclaimer</strong>
        </p>
        <p className="text-xs text-amber-900 dark:text-amber-200">
          Toate datele sunt extrase oficial din declarațiile de avere publice ANI
          (<a href="https://integritate.eu" target="_blank" rel="noopener" className="underline">integritate.eu</a>).
          Un „salt suspect" NU implică ilegalitate — există explicații legitime
          (moștenire, vânzare proprietate, etc.). Demnitarul are dreptul la right of reply.
          Civia nu acuză, expune cifre.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="py-12">
          <div className="text-center mb-8">
            <TrendingUp size={36} className="mx-auto mb-3 text-[var(--color-primary)] opacity-60" aria-hidden="true" />
            <h2 className="text-lg font-bold mb-2">Modulul e în pregătire</h2>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
              Scraper-ul ANI este în curs de dezvoltare cu review legal. Între timp,
              poți căuta orice demnitar direct pe portalul oficial:
            </p>
          </div>
          <div className="max-w-md mx-auto p-6 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Sursă oficială
            </p>
            <a
              href="https://integritate.eu/cauta-declaratie"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 font-semibold text-[var(--color-primary)] hover:underline"
            >
              integritate.eu
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Toate declarațiile de avere publice — peste 10.000 demnitari.
              Caută după nume, instituție sau localitate.
            </p>
          </div>

          <div className="mt-12 max-w-2xl mx-auto">
            <h3 className="text-sm font-bold mb-3">📋 De ce e important</h3>
            <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
              <li>• Toți demnitarii publici au obligația de a declara averea anual (Legea 176/2010).</li>
              <li>• Declarațiile sunt publice pe portalul ANI.</li>
              <li>• Discrepanțele neexplicate între ani pot indica corupție.</li>
              <li>• Civia plănuiește un sistem AI care detectează automat astfel de pattern-uri.</li>
            </ul>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((d, i) => (
            <li
              key={d.id}
              className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]"
            >
              <div className="flex items-start gap-3">
                <div className="text-center shrink-0 w-12">
                  <p className="text-xs text-[var(--color-text-muted)]">#{i + 1}</p>
                  <p className="text-xs text-rose-500 font-bold tabular-nums">
                    +{Math.round(d.suspicious_jump_pct ?? 0)}%
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base">
                    <Link href={`/verificare-avere/${d.display_slug}`} className="hover:underline">
                      {d.full_name}
                    </Link>
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {d.position}
                    {d.institution && ` · ${d.institution}`}
                    {d.party && ` · ${d.party}`}
                    {d.county && ` · ${d.county}`}
                  </p>
                  {d.ai_summary && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-2 line-clamp-2">
                      {d.ai_summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[10px] mt-2 text-[var(--color-text-muted)]">
                    <span>📅 {d.data_year}</span>
                    {d.cash_lei && <span>💵 {formatLei(d.cash_lei)}</span>}
                    {d.real_estate_count && <span>🏠 {d.real_estate_count} proprietăți</span>}
                    {d.income_total && <span>💼 {formatLei(d.income_total)} venit</span>}
                  </div>
                </div>
                <a
                  href={`https://integritate.eu/cauta-declaratie?nume=${encodeURIComponent(d.full_name)}`}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-[var(--color-text-muted)] shrink-0"
                >
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatLei(n: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}
