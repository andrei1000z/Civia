import type { Metadata } from "next";
import Link from "next/link";
import { Coins, ExternalLink, Clock } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 🚀 BIG #8 — Compass Finantare UE.
 *
 * Lista programe UE deschise + AI summary + deadline + match cu user profile.
 */

export const metadata: Metadata = {
  title: "Compass UE — Apeluri de finanțare deschise",
  description:
    "Toate apelurile de finanțare UE deschise pentru cetățeni RO. Personalizat pe interesul tău. Asistent AI pentru aplicare.",
  alternates: { canonical: "/compass-ue" },
};

export const dynamic = "force-dynamic";
export const revalidate = 600;

interface ProgramRow {
  id: string;
  name: string;
  source: string;
  source_url: string;
  description: string | null;
  target_audience: string | null;
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
  deadline: string | null;
  topics: string[] | null;
  ai_summary: string | null;
}

export default async function CompassUEPage() {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("ue_programs")
    .select("id, name, source, source_url, description, target_audience, amount_min, amount_max, currency, deadline, topics, ai_summary")
    .eq("status", "open")
    .order("deadline", { ascending: true })
    .limit(50);

  const items = (data ?? []) as ProgramRow[];

  const formatAmount = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return "Sumă nedeterminată";
    if (min && !max) return `min ${formatNumber(min)} ${currency}`;
    if (max && !min) return `până la ${formatNumber(max)} ${currency}`;
    return `${formatNumber(min!)} – ${formatNumber(max!)} ${currency}`;
  };

  const daysUntil = (deadline: string | null) => {
    if (!deadline) return null;
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms < 0) return -1;
    return Math.ceil(ms / 86400_000);
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Compass Finanțare UE"
        icon={Coins}
        gradient={HERO_GRADIENT.success}
        description={
          <>
            Toate apelurile UE deschise pentru cetățeni, antreprenori, ONG-uri,
            primării — personalizat pe interesul tău.
          </>
        }
        tagline="Banii UE pe care îi pierdem doar pentru că nu știm."
      />

      <div className="my-6 text-sm">
        <p className="text-[var(--color-text-muted)]">{items.length} programe deschise</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--color-text-muted)]">
          <Coins size={32} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p>Niciun program în baza de date.</p>
          <p className="text-xs mt-2">Programele apar în curând.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((p) => {
            const days = daysUntil(p.deadline);
            return (
              <li
                key={p.id}
                className="p-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-base font-bold">{p.name}</h2>
                  {days !== null && days >= 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 inline-flex items-center gap-1 ${days <= 7 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : days <= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}
                    >
                      <Clock size={10} aria-hidden="true" />
                      {days === 0 ? "Ultima zi" : `${days} zile`}
                    </span>
                  )}
                </div>
                {p.ai_summary && (
                  <p className="text-sm text-[var(--color-text-muted)] mb-3">
                    {p.ai_summary}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                    💰 {formatAmount(p.amount_min, p.amount_max, p.currency ?? "EUR")}
                  </span>
                  {p.target_audience && (
                    <span className="px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                      👥 {p.target_audience}
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                    📡 {p.source}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <Link
                    href={`/compass-ue/${p.id}`}
                    className="text-[var(--color-primary)] font-medium hover:underline"
                  >
                    Detalii + asistent AI →
                  </Link>
                  <a
                    href={p.source_url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-[var(--color-text-muted)]"
                  >
                    Apelul oficial
                    <ExternalLink size={10} aria-hidden="true" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ro-RO").format(n);
}
