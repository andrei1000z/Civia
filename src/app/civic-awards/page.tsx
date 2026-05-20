import type { Metadata } from "next";
import Link from "next/link";
import { Award, Trophy, Crown, Sparkles, Calendar } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Civic Awards — Premiile Civia Anuale",
  description:
    "Decembrie 2026: gala virtuală Civic Awards. Premiem cetateanul anului, primaria anului, sesizarea anului. PR moment + transparenta civica.",
  alternates: { canonical: "/civic-awards" },
};

export const revalidate = 86400;

const CATEGORIES = [
  {
    id: "citizen",
    icon: Crown,
    title: "Cetățean al Anului",
    description:
      "Cetățeanul cu cel mai mare impact civic: număr sesizari trimise + rezolvate + cosignaturi atrase.",
    criteria: ["20+ sesizari depuse", "50%+ rate de rezolvare", "100+ cosignaturi pe sesizarile lor"],
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "authority",
    icon: Trophy,
    title: "Primăria Anului",
    description:
      "Primăria cu cea mai bună rată de răspuns + rezolvare la sesizările Civia.",
    criteria: ["80%+ rate de răspuns", "60%+ rate de rezolvare", "Răspuns mediu sub 14 zile"],
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "sesizare",
    icon: Sparkles,
    title: "Sesizarea Anului",
    description:
      "Sesizarea cu cel mai mare impact public: voturi, cosignaturi, rezolvare, mass-media coverage.",
    criteria: ["200+ voturi", "30+ cosignaturi", "Rezolvată", "Acoperire media verificabilă"],
    color: "from-violet-500 to-purple-600",
  },
  {
    id: "investigation",
    icon: Award,
    title: "Investigație Civică",
    description:
      "Jurnalist sau ONG care a folosit datele publice Civia pentru o investigație de impact.",
    criteria: ["Articol / raport publicat", "Date Civia citate", "Schimbare politică / publică"],
    color: "from-cyan-500 to-blue-600",
  },
];

export default function CivicAwardsPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Civic Awards"
        icon={Award}
        gradient={HERO_GRADIENT.petition}
        description={
          <>
            <strong>Decembrie 2026</strong> · Gala virtuală anuală.
            Premiem cei mai activi cetățeni, primăriile responsive și
            sesizările cu impact din anul precedent.
          </>
        }
        tagline="4 categorii · Vot public + jurat civic · PR moment"
      />

      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-2 text-[var(--color-text)]">
          Cele 4 categorii
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Nominalizari deschise toamna 2026. Câștigatorii anunțați la gala
          virtuală în decembrie. Toate categoriile au criterii obiective
          măsurabile din date publice Civia.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.id}
                className="lc-glass-2 rounded-[var(--radius-lg)] p-5 lc-glow-hover-emerald transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-lg mb-3`}
                >
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="font-[family-name:var(--font-sora)] font-bold text-lg mb-1 text-[var(--color-text)]">
                  {c.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
                  {c.description}
                </p>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1.5">
                  Criterii obiective
                </div>
                <ul className="text-xs text-[var(--color-text)] space-y-1">
                  {c.criteria.map((cr) => (
                    <li key={cr} className="flex items-start gap-1.5">
                      <span aria-hidden="true">•</span>
                      <span>{cr}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="lc-glass-2 rounded-[var(--radius-lg)] p-6 text-center mb-6">
        <Calendar size={32} className="mx-auto mb-3 text-[var(--color-primary)]" aria-hidden="true" />
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2 text-[var(--color-text)]">
          Calendar 2026
        </h2>
        <ul className="text-sm text-[var(--color-text-muted)] space-y-2 max-w-md mx-auto text-left">
          <li className="flex items-start gap-2">
            <span className="font-mono text-[var(--color-primary)] shrink-0">Sep</span>
            <span>Anunț nominalizări deschise (1 lună)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-[var(--color-primary)] shrink-0">Oct</span>
            <span>Verificare candidați + selectare top 3 per categorie</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-[var(--color-primary)] shrink-0">Nov</span>
            <span>Vot public deschis pentru fiecare top 3</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-[var(--color-primary)] shrink-0">Dec</span>
            <span>Gala virtuală + anunț câștigători + PR</span>
          </li>
        </ul>
      </section>

      <section className="text-center py-6">
        <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
          Vrei să nominalizezi pe cineva sau să fii partener Civic Awards?
        </p>
        <Link
          href="/cont"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-gradient-to-r from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white text-sm font-semibold hover:brightness-110 transition-all lc-shine"
        >
          Sign in + propune nominalizare
        </Link>
      </section>
    </div>
  );
}
