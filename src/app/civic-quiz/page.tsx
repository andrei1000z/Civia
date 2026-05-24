import type { Metadata } from "next";
import { CivicQuizClient } from "./CivicQuizClient";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Civic Quiz — testează-ți cunoștințele despre drepturi civice",
  description:
    "15 intrebari despre OG 27/2002, Legea 544, GDPR, Constitutie. Castiga badge Cetatean Informat. 5 minute.",
  alternates: { canonical: "/civic-quiz" },
};

export const revalidate = 86400;

export default function CivicQuizPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Civic Quiz"
        icon={GraduationCap}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            10 întrebări random despre <strong>OG 27/2002</strong>,{" "}
            <strong>Legea 544</strong>, <strong>GDPR</strong> și Constituție. ~5 minute.
          </>
        }
        tagline="Testează-ți cunoștințele civice"
      />
      <CivicQuizClient />
    </div>
  );
}
