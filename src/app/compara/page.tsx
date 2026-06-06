import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { ALL_COUNTIES } from "@/data/counties";
import { CompareCountyPicker } from "./CompareCountyPicker";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Compară județele — side-by-side",
  description:
    "Vezi două județe din România comparate: sesizări, populație, accidente, calitate aer, BAC și mai multe. Folosește pentru cercetare sau curiozitate civică.",
  alternates: { canonical: "/compara" },
};

export const revalidate = 86400; // 1 day

export default function CompareLandingPage() {
  // Sort by population desc for default picks
  const sorted = [...ALL_COUNTIES].sort((a, b) => b.population - a.population);
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Compară județele"
        icon={Scale}
        gradient={HERO_GRADIENT.data}
        description="Alege două județe și vezi cifrele lor alăturate: populație, sesizări civice, accidente rutiere, calitate aer, promovabilitate BAC și primarul în funcție."
        tagline="Util pentru jurnaliști, cercetători și cetățeni curioși · 42 de județe disponibile"
      />

      <CompareCountyPicker counties={sorted.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))} />
    </div>
  );
}
