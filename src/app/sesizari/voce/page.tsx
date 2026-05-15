import type { Metadata } from "next";
import { Mic } from "lucide-react";
import { VoiceSesizareFlow } from "@/components/sesizari/VoiceSesizareFlow";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Sesizare prin voce — vorbește și trimite",
  description:
    "Apasă și vorbește. AI ascultă, înțelege locația și tipul problemei, generează scrisoarea formală automat. O singură interacțiune. Pentru cei care vor să raporteze rapid pe stradă.",
  alternates: { canonical: "/sesizari/voce" },
};

export const dynamic = "force-dynamic";

export default function SesizareVocePage() {
  return (
    <div className="container-narrow py-6 md:py-10 max-w-2xl">
      <PageHero
        title="Sesizare prin voce"
        icon={Mic}
        gradient={HERO_GRADIENT.primary}
        backHref="/sesizari"
        backLabel="Formular complet"
        description={
          <>
            Apasă și vorbește. AI ascultă, înțelege ce și unde, generează scrisoarea formală.
          </>
        }
        tagline="Pentru momente când ești pe stradă și vezi o problemă."
      />
      <VoiceSesizareFlow />
    </div>
  );
}
