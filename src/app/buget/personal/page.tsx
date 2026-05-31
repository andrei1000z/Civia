import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { BugetCalculatorClient } from "./BugetCalculatorClient";

/**
 * 🚀 BIG #4 — Buget interactiv „Pe banii MEI".
 *
 * User input: salariu net lunar + judet.
 * Output: vizual treemap cu cota din taxe lunare/anuale catre primaria locala
 * + distributie pe categorii.
 */

export const metadata: Metadata = {
  title: "Buget personal: pe banii TĂI cum cheltuiește primăria",
  description:
    "Introdu salariul lunar și află EXACT cât plătești taxe + cum se cheltuie banii la primărie. Comparație inter-orașe.",
  alternates: { canonical: "/buget/personal" },
};

export default function BugetPersonalPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Pe banii MEI — ce face primăria?"
        icon={Coins}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Introdu salariul net lunar. Civia calculează <strong>câți lei pe an</strong>{" "}
            ajung la primăria ta din taxele tale și pe ce se cheltuie.
          </>
        }
        tagline="Transparența pleacă de la cifre."
      />

      <BugetCalculatorClient />
    </div>
  );
}
