import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";

export const metadata: Metadata = {
  title: "Setări — aspect & accesibilitate | Civia",
  description:
    "Personalizează aspectul Civia: intensitatea sticlei, transparență, mărime text, mișcare redusă și semne pentru daltonism. Preferințele se salvează pe acest dispozitiv.",
};

export default function SetariPage() {
  return (
    <div className="container-narrow py-6 sm:py-8 space-y-6">
      <PageHero
        title="Setări"
        icon={Settings2}
        gradient={HERO_GRADIENT.primary}
        description="Aspect și accesibilitate. Preferințele se salvează pe acest dispozitiv — nu îți trebuie cont."
      />
      <AppearanceSettings />
    </div>
  );
}
