import type { Metadata } from "next";
import { Link as LinkIcon } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { ProposePetitieForm } from "./ProposePetitieForm";

export const metadata: Metadata = {
  title: "Propune o petiție",
  description:
    "Ai văzut o petiție pe Declic, Avaaz sau alt site? Trimite-ne link-ul și o adăugăm în catalogul Civia după verificare.",
  alternates: { canonical: "/petitii/propune" },
};

export const dynamic = "force-static";
export const revalidate = false;

export default function ProposePetitiePage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Propune o petiție"
        icon={LinkIcon}
        gradient={HERO_GRADIENT.petition}
        description={
          <>
            Ai văzut o petiție civică bună pe <strong>Declic</strong>,{" "}
            <strong>Avaaz</strong>, <strong>change.org</strong> sau alt site?
            Trimite-ne link-ul + două vorbe despre ce e — o verificăm și
            apare în catalog în 1-2 ore.
          </>
        }
        tagline="Singura condiție: să fie despre ceva civic — administrație, drepturi, mediu, transparență. Nu reclamă comercială."
      />

      <ProposePetitieForm />
    </div>
  );
}
