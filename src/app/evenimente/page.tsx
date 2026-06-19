import type { Metadata } from "next";
import { evenimente } from "@/data/evenimente";
import { History } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { EvenimenteFilter } from "@/components/evenimente/EvenimenteFilter";

export const metadata: Metadata = {
  title: "Evenimente majore — România",
  description: "Cronologia evenimentelor semnificative din România: accidente, incendii, inundații, cutremure, proteste — din 1989 până azi.",
  alternates: { canonical: "/evenimente" },
};

export default function EvenimentePage() {
  const sorted = [...evenimente].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="container-narrow py-8 md:py-10">
      {/* 2026-06-19 (audit #19) — PageHero canonic în loc de hero hand-rolled. */}
      <PageHero
        icon={History}
        gradient={HERO_GRADIENT.news}
        title="Evenimentele care au marcat România"
        description={`${sorted.length} evenimente documentate din ${new Date(sorted[sorted.length - 1]?.data ?? "1940").getFullYear()} până azi — accidente, incendii, inundații, cutremure și proteste.`}
        tagline="Arhivă cronologică"
      />
      <div className="mt-6 md:mt-8">
        <EvenimenteFilter evenimente={sorted} />
      </div>
    </div>
  );
}
