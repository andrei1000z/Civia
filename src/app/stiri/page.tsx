import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { StiriList } from "@/components/stiri/StiriList";
import { Badge } from "@/components/ui/Badge";
import { SOURCE_COLORS, SITE_URL, readableTextColor } from "@/lib/constants";
import { CollectionPageJsonLd } from "@/components/JsonLd";
import { NATIONAL_SOURCES } from "@/lib/stiri/sources";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Știri civice România",
  description:
    "Articole agregate din 15 surse naționale verificate (Digi24, Hotnews, G4Media, PressOne, Spotmedia, Europa Liberă, Recorder, ZF, …) — transport, urbanism, mediu, administrație din toată România.",
  alternates: { canonical: "/stiri" },
};

// ISR 30 minute — paired cu cron-ul zilnic + self-healing fetch pe trafic.
// Pagina re-randează la max 30 min, dar conținutul e mai fresh: când userul
// deschide pagina, /api/stiri/route.ts trigger-uiește background fetch
// dacă a trecut > 5 min de la ultima rulare (Redis lock). Combinația dă
// retenție foarte fresh fără să stresăm Supabase pentru fiecare visit.
export const revalidate = 1800;

export default function StiriPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <CollectionPageJsonLd
        name="Știri civice — Civia"
        description="Catalog de știri civice agregate din surse naționale verificate (Digi24, Hotnews, G4Media, Mediafax, News.ro, PressOne, Spotmedia, Europa Liberă, Recorder, Ziarul Financiar, Libertatea, Adevărul, Gândul) și 21 de ziare locale: transport, urbanism, mediu, administrație, siguranță."
        url={`${SITE_URL}/stiri`}
      />

      <PageHero
        title="Știri civice"
        icon={Newspaper}
        gradient={HERO_GRADIENT.news}
        description={
          <>
            <strong>{NATIONAL_SOURCES.length} surse naționale</strong> verificate
            — wire-service, investigative independente și business. Pentru
            ziarele locale din județul tău, deschide pagina județului
            corespunzător.
          </>
        }
        tagline="Fiecare articol primește o sinteză structurată — citești esența în 30 de secunde."
      >
        <div className="flex flex-wrap gap-1.5 mt-4">
          {NATIONAL_SOURCES.map((source) => (
            <Badge
              key={source}
              bgColor={SOURCE_COLORS[source] ?? "#64748b"}
              color={readableTextColor(SOURCE_COLORS[source] ?? "#64748b")}
              className="text-[10px]"
            >
              {source}
            </Badge>
          ))}
        </div>
      </PageHero>

      <StiriList />
    </div>
  );
}
