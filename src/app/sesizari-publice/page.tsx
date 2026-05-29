import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { SesizariPublice } from "@/components/sesizari/SesizariPublice";
import { CollectionPageJsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Vezi ce semnalează cetățenii",
  description:
    "Probleme reale din orașele României: gropi, trotuare distruse, iluminat defect, parcări ilegale. Votează și trimite și tu — mai multe voci = răspuns mai rapid de la primărie.",
  alternates: { canonical: "/sesizari-publice" },
};

// 2026-05-29 — ISR cu revalidate 60s. Pagina dynamic per request era
// costisitoare; lista publică update lent. Cu revalidate=60, primul request
// post-60s declanseaza re-render in background, restul servesc cache.
export const revalidate = 60;

export default function SesizariPublicePage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <CollectionPageJsonLd
        name="Sesizări publice — Civia"
        description="Catalog cu sesizări trimise de cetățeni la primării și autorități locale. Filtrat pe tip, sector, status. Votează pentru cele care te afectează."
        url={`${SITE_URL}/sesizari-publice`}
      />
      <PageHero
        backHref="/sesizari"
        backLabel="Trimit și eu o sesizare"
        title="Ce se întâmplă în orașul tău"
        icon={Eye}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Sesizări de la cetățeni. <strong>Votează</strong> sau apasă{" "}
            <strong>„Trimite și tu"</strong> — mai multe voci = prioritate mai mare la primărie.
          </>
        }
        tagline="Numere mari schimbă prioritatea la primărie."
      />

      <SesizariPublice />
    </div>
  );
}
