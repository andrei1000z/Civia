import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, MapPin, Users } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { JudeteGrid } from "./JudeteGrid";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { ALL_COUNTIES } from "@/data/counties";

export const metadata: Metadata = {
  title: "Alege sau schimbă județul",
  description:
    "42 de județe ale României într-un singur loc. Civia reține preferința ta de județ la următoarea vizită. Pe această pagină poți schimba oricând județul salvat sau șterge preferința.",
  alternates: { canonical: "/judete" },
};

export const revalidate = 86400; // 24h — county metadata barely changes

async function getCountyStats(): Promise<Record<string, number>> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("sesizari")
      .select("county")
      .eq("moderation_status", "approved");
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { county: string | null }[]) {
      const c = row.county ?? "B";
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

async function getAuthorityCount(): Promise<Record<string, number>> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin.from("authorities").select("county_id");
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { county_id: string | null }[]) {
      const c = row.county_id ?? "?";
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export default async function JudetePage() {
  const [sesizariStats, authStats] = await Promise.all([
    getCountyStats(),
    getAuthorityCount(),
  ]);

  // Aggregates rendered as a contextual subline under the hero — no
  // separate "stat hero" block, just signals the user can trust the
  // page is connected to live data.
  const totalCounties = ALL_COUNTIES.length;
  const totalAuthorities = Object.values(authStats).reduce((a, b) => a + b, 0);
  const totalSesizari = Object.values(sesizariStats).reduce((a, b) => a + b, 0);
  const totalPopulation = ALL_COUNTIES.reduce((sum, c) => sum + c.population, 0);

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Alege sau schimbă județul"
        icon={MapPin}
        gradient={HERO_GRADIENT.primary}
        description="Civia reține județul tău la următoarea vizită și te duce direct acolo. De aici îl poți schimba oricând — click pe alt județ ca să-l salvezi în loc."
        tagline={`${totalCounties} de județe · ${totalPopulation.toLocaleString("ro-RO")} locuitori · sesizările, hărțile, calitatea aerului și știrile se filtrează automat după județul ales`}
      />

      {/* Live signal strip — pulled from production data so the page feels alive.
          Mobile (360px): grid-cols-3 strângea text-ul prea tare → 1 col mobile,
          3 col de la sm (640px+). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 -mt-2">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
            Județe pe Civia
          </p>
          <p className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]">
            {totalCounties}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            toată România, fără excepții
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
            Sesizări active
          </p>
          <p className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]">
            {totalSesizari.toLocaleString("ro-RO")}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            depuse de cetățeni, vizibile public
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
            Autorități indexate
          </p>
          <p className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]">
            {totalAuthorities.toLocaleString("ro-RO")}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            primării, prefecturi, ISU, DSP, ISJ etc.
          </p>
        </div>
      </div>

      <JudeteGrid sesizariStats={sesizariStats} authStats={authStats} />

      {/* CTA */}
      <div className="mt-12 relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] via-emerald-700 to-indigo-900 rounded-[var(--radius-lg)] shadow-[var(--shadow-3)] p-8 md:p-10 text-white">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(120,119,198,0.25),transparent)]"
          aria-hidden="true"
        />
        <div className="relative z-10 grid md:grid-cols-[1fr_auto] items-center gap-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-100/90 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full backdrop-blur-sm mb-3">
              <Users size={10} aria-hidden="true" />
              Pentru orice cetățean
            </p>
            <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-extrabold mb-2 leading-tight">
              Nu-ți găsești județul?
            </h2>
            <p className="text-emerald-100/85 max-w-xl leading-relaxed text-sm md:text-base">
              Folosește direct fluxul de sesizare — detectăm automat județul
              și autoritățile competente din locația ta GPS.
            </p>
          </div>
          <Link
            href="/sesizari"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-full)] bg-white text-[var(--color-primary)] font-semibold hover:bg-white/90 active:scale-[0.97] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700 shrink-0"
          >
            <FileText size={16} aria-hidden="true" />
            Fă o sesizare
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
