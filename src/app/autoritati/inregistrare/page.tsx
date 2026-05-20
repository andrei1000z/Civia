import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { AuthorityRegisterForm } from "./AuthorityRegisterForm";

export const metadata: Metadata = {
  title: "Inregistrare autoritate publica — Civia",
  description:
    "Esti primar, viceprimar sau functionar la o primarie? Inregistreaza autoritatea ta pe Civia pentru a raspunde direct cetatenilor.",
  alternates: { canonical: "/autoritati/inregistrare" },
  robots: { index: false, follow: true },
};

export const revalidate = 86400;

export default function AuthorityRegisterPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Inregistrare autoritate publica"
        icon={Building2}
        gradient={HERO_GRADIENT.authority}
        description={
          <>
            Reprezinti o <strong>primarie / consiliu local / politie locala</strong>?
            Creeaza-ti un cont oficial Civia. Poti raspunde direct la sesizarile
            cetatenilor, marca status, upload poza rezolvare.
          </>
        }
        tagline="Verificare manuala de admin Civia + email oficial. 1-2 zile."
      />

      <AuthorityRegisterForm />
    </div>
  );
}
