import type { Metadata } from "next";
import { Search } from "lucide-react";
import { UrmarireSesizare } from "@/components/sesizari/UrmarireSesizare";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Urmărește-ți sesizarea",
  description:
    "Ai trimis o sesizare prin Civia? Introdu codul primit la trimitere și vezi unde e — pe ce autoritate a ajuns, dacă a fost aprobată public, câți cetățeni au trimis și ei.",
  alternates: { canonical: "/urmareste" },
};

export default function UrmarestePage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        backHref="/sesizari"
        backLabel="Formular nou de sesizare"
        title="Unde a ajuns sesizarea ta?"
        icon={Search}
        gradient={HERO_GRADIENT.primary}
        description="Introdu codul de 6 caractere primit la trimitere. Vezi statusul oficial, comentariile și dacă a fost marcată drept rezolvată."
        tagline="Codul îl ai pe email și pe pagina sesizării imediat după trimitere."
      />

      <UrmarireSesizare />
    </div>
  );
}
