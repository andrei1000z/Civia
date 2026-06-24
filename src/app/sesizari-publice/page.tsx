import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { SesizariPublice } from "@/components/sesizari/SesizariPublice";
import { CollectionPageJsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { listSesizari } from "@/lib/sesizari/repository";
import { getSesizariStatsCached } from "@/lib/cached-queries";

export const metadata: Metadata = {
  title: "Vezi ce semnalează cetățenii",
  description:
    "Probleme reale din orașele României: gropi, trotuare distruse, iluminat defect, parcări ilegale. Votează și trimite și tu — mai multe voci = răspuns mai rapid de la primărie.",
  alternates: { canonical: "/sesizari-publice" },
};

// 2026-06-24 — prima pagină + statisticile sunt randate pe server (carduri reale
// la primul paint, fără skeleton + waterfall client pe mobil/4g). Dinamic pentru
// că listSesizari anonimizează autorii în funcție de cine vizualizează (per-viewer);
// datele oricum se aduceau per-request prin /api/sesizari, deci nu pierdem cache —
// doar eliminăm un round-trip client.
export const dynamic = "force-dynamic";

export default async function SesizariPublicePage() {
  const [initialRows, stats] = await Promise.all([
    listSesizari({ limit: 24 }).catch(() => []),
    getSesizariStatsCached().catch(() => null),
  ]);

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

      <SesizariPublice
        initialRows={initialRows}
        initialTotalCount={stats?.total ?? null}
        initialResolvedCount={stats?.rezolvate ?? null}
      />
    </div>
  );
}
