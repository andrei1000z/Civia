import type { Metadata } from "next";
import Link from "next/link";
import { Target, Plus } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 🚀 BIG #5 — Inițiative cetățenești cu OTP SMS.
 *
 * Lista publică a inițiativelor active din țară. Fiecare cu progress bar
 * semnături + buton „Semnez și eu" (modal OTP SMS).
 */

export const metadata: Metadata = {
  title: "Inițiative cetățenești — Acțiune locală reală",
  description:
    "Inițiative cetățenești locale care respectă Legea 189/1999. Adună semnături, validează cu SMS, generează dosarul oficial pentru Consiliul Local.",
  alternates: { canonical: "/initiative" },
};

export const revalidate = 60;

interface InitiativeRow {
  id: string;
  slug: string;
  titlu: string;
  descriere: string;
  obiectiv: string;
  county: string;
  locality: string | null;
  signatures_target: number;
  status: string;
  created_at: string;
}

export default async function InitiativeListPage() {
  const admin = createSupabaseAdmin();
  const { data: initiatives } = await admin
    .from("initiative")
    .select("id, slug, titlu, descriere, obiectiv, county, locality, signatures_target, status, created_at")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(30);

  const items = (initiatives ?? []) as InitiativeRow[];

  // Pentru fiecare, count semnaturi verificate
  const counts: Record<string, number> = {};
  for (const it of items) {
    const { count } = await admin
      .from("initiative_signatures")
      .select("id", { count: "exact", head: true })
      .eq("initiative_id", it.id)
      .eq("otp_verified", true);
    counts[it.id] = count ?? 0;
  }

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Inițiative cetățenești"
        icon={Target}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Schimbare locală reală. Adună semnături online, validează cu{" "}
            <strong>SMS gratuit</strong>, generează dosarul oficial,{" "}
            depune la Consiliul Local.
          </>
        }
        tagline="Legea 189/1999 — democrație directă, fără birocrație."
      />

      <div className="my-6 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          {items.length} inițiative active
        </p>
        <Link
          href="/initiative/nou"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Lansează inițiativă
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--color-text-muted)]">
          <Target size={32} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p>Nicio inițiativă lansată încă. Fii primul!</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => {
            const signed = counts[it.id] ?? 0;
            // guard împărțire la 0 → 0/0 = NaN → width stricat.
            const pct = it.signatures_target > 0
              ? Math.min(100, Math.round((signed / it.signatures_target) * 100))
              : 0;
            return (
              <li
                key={it.id}
                className="p-5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-base font-bold">
                    <Link href={`/initiative/${it.slug}`} className="hover:underline">
                      {it.titlu}
                    </Link>
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold shrink-0">
                    {it.locality ?? it.county}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-3 line-clamp-2">
                  {it.descriere}
                </p>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">
                      {signed} / {it.signatures_target} semnături
                    </span>
                    <span className="text-[var(--color-primary)] font-bold">{pct}%</span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-primary)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <Link
                  href={`/initiative/${it.slug}`}
                  className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  Semnez și eu →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
