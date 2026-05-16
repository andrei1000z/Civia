import type { Metadata } from "next";
import Link from "next/link";
import { Vote, AlertCircle } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { ELECTION_RACES } from "@/data/alegeri";
import { formatMonthYear } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Election Compass — promisiuni vs livrare",
  description:
    "Compară candidații la alegerile locale, parlamentare și europene din România. Promisiuni civice vs livrare reală, bazat pe date publice.",
  alternates: { canonical: "/alegeri" },
};

export default function AlegeriPage() {
  // Sortăm: viitoare → trecute.
  const sorted = [...ELECTION_RACES].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date().toISOString().slice(0, 7);
  const upcoming = sorted.filter((r) => r.date >= now);
  const past = sorted.filter((r) => r.date < now);

  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Election Compass"
        icon={Vote}
        gradient={HERO_GRADIENT.authority}
        description="Compară candidații pe întrebări civice clare. Promisiunile pre-alegeri rămân publice — urmărim livrarea după mandat."
        tagline="Date publice · Bias-free · Comparabil cross-candidate"
      />

      {upcoming.length > 0 && (
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-4">
            Alegeri viitoare
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {upcoming.map((r) => (
              <Link
                key={r.slug}
                href={`/alegeri/${r.slug}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/30 hover:-translate-y-0.5 transition-all"
              >
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-primary)] mb-1">
                  {r.type}
                </p>
                <h3 className="font-bold text-lg mb-1">{r.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {r.scope} · {formatMonthYear(r.date)} · {r.candidates.length} candidați
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-4">
            Alegeri trecute — verifică livrarea
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 opacity-80">
            {past.map((r) => (
              <Link
                key={r.slug}
                href={`/alegeri/${r.slug}`}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 hover:shadow-[var(--shadow-2)] transition-all"
              >
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1">
                  {r.type} · {formatMonthYear(r.date)}
                </p>
                <h3 className="font-bold text-base mb-1">{r.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{r.scope}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Card>
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm text-[var(--color-text-muted)]">
            <p className="font-semibold text-[var(--color-text)] mb-1">Despre Election Compass</p>
            <p className="leading-relaxed">
              Catalogul e construit din date publice — declarații AEP, programe partid, articole verificate.
              Nu favorizăm niciun partid. Dacă găsești o omisiune sau o eroare, scrie-ne la{" "}
              <a href="mailto:contact@civia.ro" className="text-[var(--color-primary)] underline">
                contact@civia.ro
              </a>{" "}
              cu sursă publică.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
