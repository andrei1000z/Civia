import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  MapPin,
  ExternalLink,
  Rss,
  Download,
} from "lucide-react";
import {
  TYPE_ICONS,
  TYPE_LABELS,
} from "@/data/intreruperi";
import { loadInterruptions } from "@/lib/intreruperi/store";
import { SITE_URL } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";
import { IntreruperiFilters } from "./IntreruperiFilters";
import { SubmitForm } from "./SubmitForm";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Întreruperi programate — apă, caldură, gaz, curent, lucrări stradă",
  description:
    "Află din timp când se taie apa, caldura, gazul sau curentul în orașul tău + lucrările de stradă în desfășurare. Catalogate din surse oficiale (Apa Nova, Termoenergetica, Distrigaz, E-Distribuție, PMB).",
  alternates: {
    canonical: "/intreruperi",
    types: {
      "application/rss+xml": [
        { url: "/intreruperi/rss", title: "Întreruperi Civia RSS" },
      ],
      "text/calendar": [
        { url: "/api/intreruperi/ics", title: "Calendar iCalendar" },
      ],
    },
  },
  openGraph: {
    title: "Întreruperi programate — Civia",
    description:
      "Nu mai afla din baie că „s-a oprit iar apa”. Vezi în avans toate întreruperile programate + lucrările la stradă.",
    type: "website",
    locale: "ro_RO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Întreruperi programate — Civia",
    description: "Apă, caldură, gaz, curent + lucrări de stradă. Subscribe RSS sau iCal.",
  },
  keywords: [
    "întreruperi apă",
    "întreruperi caldură",
    "lucrări stradă București",
    "Apa Nova",
    "Termoenergetica",
    "avarie apă",
    "programare lucrări",
  ],
};

// 2026-05-19: ridicat la 2h (7200s) — scraperul de intreruperi rulează 1x/zi
// (Vercel Hobby cron). Date noi apar maxim o data/zi, deci 2h e abundent.
// Inainte: 30min — producea ISR writes inutile (Vercel over-limit).
export const revalidate = 7200;

export default async function IntreruperiPage() {
  const { items, scrapedCount, lastSeenAt, source } = await loadInterruptions();
  // Filter active (same logic ca getActiveInterruptions ca să nu se schimbe
  // comportamentul vechi, dar acum avem și metadata pentru hero).
  // eslint-disable-next-line react-hooks/purity -- ISR Server Component, Date.now() captured per regeneration
  const now = Date.now();
  const all = items
    .filter((i) => {
      if (i.status === "anulat" || i.status === "finalizat") return false;
      return new Date(i.endAt).getTime() > now;
    })
    .sort((a, b) => {
      if (a.status === "in-desfasurare" && b.status !== "in-desfasurare") return -1;
      if (a.status !== "in-desfasurare" && b.status === "in-desfasurare") return 1;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });

  const lastUpdateLabel = lastSeenAt
    ? new Date(lastSeenAt).toLocaleString("ro-RO", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Bucharest",
      })
    : null;

  // Dataset JSON-LD pentru Google (catalog utilitar)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Întreruperi programate România",
    description:
      "Date de contact pentru întreruperi programate de apă, caldură, gaz, curent + lucrări la stradă, agregate din surse oficiale.",
    url: `${SITE_URL}/intreruperi`,
    keywords: [
      "întreruperi apă",
      "întreruperi caldură",
      "lucrări stradă",
      "Apa Nova",
      "Termoenergetica",
    ],
    creator: { "@type": "Organization", name: "Civia", url: SITE_URL },
    spatialCoverage: { "@type": "Country", name: "Romania" },
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        title="Întreruperi programate"
        icon={AlertTriangle}
        gradient={HERO_GRADIENT.warning}
        description={
          <>
            Află din timp când ți se oprește apa, caldura, gazul sau curentul + lucrările
            de stradă în curs. Agregat automat din <strong>30 de surse oficiale</strong>{" "}
            naționale (Apa Nova, RAJA, Aquatim, DEER, REE, ENGIE, PMB ș.a.) la fiecare
            12 ore.
          </>
        }
        tagline={
          <>
            {all.length} {all.length === 1 ? "întrerupere activă" : "întreruperi active"}
            {scrapedCount > 0 && ` · ${scrapedCount} entry scrapuite în ultimele 7 zile`}
            {lastUpdateLabel && (
              <>
                {" · ultima actualizare "}<strong>{lastUpdateLabel}</strong>
              </>
            )}
            {source === "seed-only" && " · folosim catalogul de seed până când scraper-ul rulează prima dată"}
          </>
        }
      />

      {/* Stats quick — five real categories instead of four. The
          stat block was rendering apa/caldura/gaz/electricitate but
          /intreruperi catalog ALSO scrapes lucrari-strazi (street
          works), and the count there is often non-trivial — surfacing
          it in the stat row matches what the filter chips offer. */}
      {/* Mobile: 3 cols (compact, 5 carduri = 3+2 layout natural).
          Tablet+: 5 col equal. Pe iPhone narrow (360px), grid-cols-2
          forța text-ul "Electricitate" / "Lucrări la stradă" peste
          marginea card-ului. Trecut și label la break-words ca
          "Lucrări la stradă" să se rupă pe 2 linii. */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-8">
        {(["apa", "caldura", "gaz", "electricitate", "lucrari-strazi"] as const).map((t) => {
          const count = all.filter((i) => i.type === t).length;
          return (
            <div
              key={t}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 md:p-4 min-w-0"
            >
              <div className="text-xl md:text-2xl mb-1">{TYPE_ICONS[t]}</div>
              <div className="text-xl md:text-2xl font-bold text-[var(--color-primary)] font-[family-name:var(--font-sora)] tabular-nums">
                {count}
              </div>
              <div className="text-[10px] md:text-xs text-[var(--color-text-muted)] mt-0.5 leading-tight break-words">
                {TYPE_LABELS[t]}
              </div>
            </div>
          );
        })}
      </div>

      {/* County picker — navigheaza la /intreruperi/[county-slug] pentru
          o pagina dedicata per judet. Ordonat dupa numarul de intreruperi
          active descrescator, ca user-ul sa vada judetele „fierbinti" primele. */}
      {(() => {
        const countsByCounty = new Map<string, number>();
        for (const i of all) {
          countsByCounty.set(i.county, (countsByCounty.get(i.county) ?? 0) + 1);
        }
        const countiesWithActivity = ALL_COUNTIES
          .map((c) => ({ ...c, count: countsByCounty.get(c.id) ?? 0 }))
          .filter((c) => c.count > 0)
          .sort((a, b) => b.count - a.count);
        if (countiesWithActivity.length === 0) return null;
        return (
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3 text-[var(--color-text)] flex items-center gap-2">
              <MapPin size={14} aria-hidden="true" />
              Vezi pe județe
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                · {countiesWithActivity.length}{" "}
                {countiesWithActivity.length === 1 ? "județ activ" : "județe active"}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {countiesWithActivity.map((c) => (
                <Link
                  key={c.id}
                  href={`/intreruperi/${c.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[var(--radius-full)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)] transition-colors"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                    {c.count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })()}

      {all.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
          <Calendar
            size={40}
            className="mx-auto mb-3 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
          <h2 className="font-semibold text-lg mb-1">
            Nicio întrerupere programată în catalog
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4 max-w-md mx-auto leading-relaxed">
            Sunt vești bune — sau înseamnă că anunțul nu a ajuns încă în
            catalog. Verifică din nou peste câteva ore. Dacă știi o
            întrerupere despre care nu vezi nimic aici, raporteaz-o tu mai jos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="#submit-form"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              Raportează una <span aria-hidden="true">↓</span>
            </Link>
            <a
              href="/intreruperi/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg)] transition-colors"
            >
              <Rss size={14} aria-hidden="true" /> Subscribe RSS
            </a>
          </div>
        </div>
      ) : (
        <IntreruperiFilters items={all} />
      )}

      {/* User submission — cineva care știe ceva despre întreruperi poate raporta */}
      <section id="submit-form" className="mt-12 border-t-2 border-dashed border-[var(--color-border)] pt-10 scroll-mt-24">
        <div className="text-center mb-6 max-w-2xl mx-auto">
          <h2 className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mb-2">
            Știi o întrerupere pe care nu o vezi aici?
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Anunțurile afișate în bloc, avizele din vecini, lucrările pe care
            le vezi pe stradă — raportează-le aici. Moderarea durează câteva
            ore, apoi apar în catalog pentru toți.
          </p>
        </div>
        <div className="max-w-xl mx-auto">
          <SubmitForm />
        </div>
      </section>

      {/* Subscribe bar — ICS + RSS + API */}
      <section className="mt-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Calendar size={16} aria-hidden="true" /> Rămâi la curent automat
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
          Nu mai verifica manual. Subscribe la calendar sau RSS — actualizate
          la 30 minute.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <a
            href="/api/intreruperi/ics"
            download="civia-intreruperi.ics"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--radius-xs)] bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors justify-center"
          >
            <Download size={14} aria-hidden="true" /> Calendar (ICS)
          </a>
          <a
            href="/intreruperi/rss"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--radius-xs)] bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors justify-center"
          >
            <Rss size={14} aria-hidden="true" /> Flux RSS
          </a>
          <a
            href="/api/intreruperi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium hover:bg-[var(--color-bg)] transition-colors justify-center"
          >
            <ExternalLink size={14} aria-hidden="true" /> JSON API
          </a>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          <strong>Subscribe în Google Calendar:</strong> Add calendar → From URL
          → <code className="text-[11px]">https://civia.ro/api/intreruperi/ics</code>
        </p>
      </section>

      <section className="mt-6 bg-[var(--color-primary-soft)] rounded-[var(--radius-md)] p-6">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2 flex items-center gap-2">
          <MapPin size={18} aria-hidden="true" /> 30 surse oficiale
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          Fiecare întrerupere provine dintr-un anunț public al unuia dintre operatorii
          de mai jos. Scraper-ul Civia rulează automat la 12 ore. Click pe oricare
          → pagina originală cu detaliile complete.
        </p>

        <div className="space-y-5">
          <SourceGroup
            icon="💧"
            title="Apă (18 companii)"
            sources={[
              { name: "Apa Nova București", url: "https://apanovabucuresti.ro/intreruperi", county: "B" },
              { name: "RAJA Constanța", url: "https://www.rajac.ro/avarii/", county: "CT" },
              { name: "Aquatim Timișoara", url: "https://www.aquatim.ro/avarii-curente/", county: "TM" },
              { name: "Apavital Iași", url: "https://www.apavital.ro/intreruperi/", county: "IS" },
              { name: "CASom Cluj-Napoca", url: "https://www.casomes.ro/intreruperi-furnizare-apa/", county: "CJ" },
              { name: "CAB Brașov", url: "https://www.apabrasov.ro/intreruperi/", county: "BV" },
              { name: "Apă Canal Galați", url: "https://www.apa-canal.ro/avarii/", county: "GL" },
              { name: "ApaServ Prahova", url: "https://www.apaservprahova.ro/intreruperi-apa/", county: "PH" },
              { name: "CAO Oradea", url: "https://www.cao.ro/intreruperi-furnizare-apa/", county: "BH" },
              { name: "ApaServ Sibiu", url: "https://www.apaserv-sibiu.ro/avarii-intreruperi/", county: "SB" },
              { name: "CA Arad", url: "https://www.caarad.ro/intreruperi/", county: "AR" },
              { name: "ApaServ Satu Mare", url: "https://www.apaserv.eu/intreruperi/", county: "SM" },
              { name: "CTTA Alba", url: "https://www.captasapa.ro/intreruperi/", county: "AB" },
              { name: "Aquaserv Mureș", url: "https://www.aquaserv.ro/intreruperi-furnizare-apa/", county: "MS" },
              { name: "CA Bacău", url: "https://www.cabacau.ro/intreruperi/", county: "BC" },
              { name: "AC 2000 Pitești", url: "https://www.apa-canal2000.ro/intreruperi/", county: "AG" },
              { name: "CA Craiova", url: "https://www.apacraiova.ro/intreruperi/", county: "DJ" },
              { name: "CA Buzău", url: "https://www.cabuzau.ro/intreruperi/", county: "BZ" },
            ]}
          />

          <SourceGroup
            icon="🔥"
            title="Termoficare (4 sisteme)"
            sources={[
              { name: "Termoenergetica București", url: "https://www.cmteb.ro/", county: "B" },
              { name: "Colterm Timișoara", url: "https://www.colterm.ro/", county: "TM" },
              { name: "Veolia Energie Iași", url: "https://www.dalkia.ro/", county: "IS" },
              { name: "CET Brașov", url: "https://www.cet.brasov.ro/", county: "BV" },
            ]}
          />

          <SourceGroup
            icon="⚡"
            title="Electricitate (4 distribuitori naționali)"
            sources={[
              { name: "E-Distribuție Muntenia", url: "https://www.e-distributie.com/clienti/lucrari-planificate.html", county: "B" },
              { name: "Rețele Electrice România (REE)", url: "https://www.retele-electrice.ro/", county: "multi" },
              { name: "DEER (Electrica)", url: "https://www.distributie-energie.ro/", county: "multi" },
              { name: "Distribuție Oltenia", url: "https://www.distributieoltenia.ro/", county: "multi" },
            ]}
          />

          <SourceGroup
            icon="🛢️"
            title="Gaz (2 distribuitori)"
            sources={[
              { name: "DELGAZ Grid", url: "https://www.delgaz.ro/comunicate-presa/", county: "multi" },
              { name: "ENGIE / Distrigaz Sud", url: "https://www.engie.ro/avarii-intreruperi/", county: "B + sud" },
            ]}
          />

          <SourceGroup
            icon="🚧"
            title="Lucrări strazi (1)"
            sources={[
              { name: "Primăria Municipiului București (PMB API)", url: "https://www.pmb.ro/anunturi-lucrari", county: "B" },
            ]}
          />

          <SourceGroup
            icon="📰"
            title="Fallback floor (presa locală)"
            sources={[
              { name: "30+ surse de presă agregate de Civia", url: "/stiri", county: "național" },
            ]}
          />
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-5 leading-relaxed pt-4 border-t border-[var(--color-border)]">
          Lipsește operatorul tău local? Spune-ne via formularul „Știi o întrerupere?"
          de mai sus, sau direct la <Link href="/#footer-feedback" className="text-[var(--color-primary)] hover:underline">feedback footer</Link> — îl adăugăm la
          următorul update.
        </p>
      </section>
    </div>
  );
}

interface SourceGroupItem {
  name: string;
  url: string;
  county: string;
}

function SourceGroup({
  icon,
  title,
  sources,
}: {
  icon: string;
  title: string;
  sources: SourceGroupItem[];
}) {
  return (
    <div>
      <h3 className="font-[family-name:var(--font-sora)] font-bold text-sm mb-2.5 inline-flex items-center gap-1.5">
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-xs">
        {sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-bg)] transition-colors"
            >
              <ExternalLink size={10} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] shrink-0" aria-hidden="true" />
              <span className="truncate flex-1 group-hover:text-[var(--color-primary)] transition-colors">
                {s.name}
              </span>
              <span className="text-[9px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider shrink-0">
                {s.county}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
