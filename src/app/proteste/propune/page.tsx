import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { ProteSubmitForm } from "./ProteSubmitForm";

export const metadata: Metadata = {
  title: "Propune un protest",
  description:
    "Anunță un protest civic public pe Civia. Echipa verifică submisia înainte de publicare.",
  alternates: { canonical: "/proteste/propune" },
};

export default function PropuneProtestPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Propune un protest"
        icon={Megaphone}
        gradient={HERO_GRADIENT.warning}
        backHref="/proteste"
        backLabel="Toate protestele"
        description={
          <>
            Anunță un protest, miting sau marș civic public. Echipa Civia verifică
            submisia (de obicei în <strong>1–2 ore</strong>) înainte să apară pe site.
          </>
        }
        tagline="6 câmpuri obligatorii. Restul, opționale — admin-ul completează la moderare."
      />

      <ProteSubmitForm />
    </div>
  );
}
