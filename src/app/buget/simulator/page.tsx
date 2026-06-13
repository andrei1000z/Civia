import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { BugetSimulator } from "@/components/buget/BugetSimulator";

export const metadata: Metadata = {
  title: "Tu împarți bugetul — simulator pe alocările reale ale primăriei",
  description:
    "Joc de 90 de secunde: împarte bugetul orașului pe categorii, apoi compară cu alocarea reală a unei primării de capitală. Cât de aproape ești de realitate?",
  alternates: { canonical: "/buget/simulator" },
};

export const revalidate = 86400;

export default function BugetSimulatorPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Tu împarți bugetul"
        description="Ai în față bugetul orașului. Împarte-l pe categorii cum crezi tu — apoi vezi cum îl împarte primăria în realitate. 90 de secunde."
        icon={PiggyBank}
        gradient={HERO_GRADIENT.data}
        tagline="Commit, apoi reveal — fără să tragi cu ochiul"
        backHref="/buget/personal"
        backLabel="Bugetul tău personal"
      />

      <main className="mx-auto max-w-2xl">
        <BugetSimulator />

        <p className="mt-8 text-xs text-[var(--color-text-muted)]">
          Metodologie: procentele „reale” sunt distribuția tipică a bugetului unei primării de
          capitală (2024) — aceeași folosită de calculatorul{" "}
          <a href="/buget/personal" className="font-semibold text-[var(--color-primary)] underline">
            „unde se duc taxele tale”
          </a>
          . E o simplificare educațională, nu execuția bugetară exactă a unui an anume.
        </p>
      </main>
    </div>
  );
}
