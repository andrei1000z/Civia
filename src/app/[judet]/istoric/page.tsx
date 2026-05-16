import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Building2, Users, ArrowRight, Clock, History } from "lucide-react";
import { getCountyBySlug, ALL_COUNTIES } from "@/data/counties";
import { getCountyStats } from "@/data/statistici-judete";
import { primari, consiliiGenerale } from "@/data/primari";
import { IstoricInteractive } from "@/components/istoric/IstoricInteractive";
import {
  CountyPageHero,
  COUNTY_HERO_GRADIENT,
} from "@/components/county/CountyPageHero";

const ChartLoading = () => (
  <div className="h-[260px] rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] animate-pulse" />
);
const DurateMandateChart = dynamic(
  () => import("@/components/charts/IstoricCharts").then((m) => ({ default: m.DurateMandateChart })),
  { loading: ChartLoading },
);
const CompozitieCGChart = dynamic(
  () => import("@/components/charts/IstoricCharts").then((m) => ({ default: m.CompozitieCGChart })),
  { loading: ChartLoading },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  return {
    title: `Istoric administratie — ${county.name}`,
    description:
      county.id === "B"
        ? `Toti primarii Bucurestiului din 1989 pana azi: realizari, controverse, proiecte.`
        : `Informatii despre administratia locala din ${county.name} — primar, consiliu judetean, prefectura.`,
    alternates: { canonical: `/${county.slug}/istoric` },
  };
}

function BucurestiIstoric() {
  const bucCounty = ALL_COUNTIES.find((c) => c.id === "B")!;
  return (
    <div className="container-narrow py-8 md:py-12">
      <CountyPageHero
        countyName={bucCounty.name}
        countyId={bucCounty.id}
        countySlug={bucCounty.slug}
        title="Istoric administrație"
        icon={History}
        gradient={COUNTY_HERO_GRADIENT.history}
        description={
          <>
            Toți primarii generali ai Capitalei din 1990 până în prezent —
            realizările, controversele și proiectele. Click pe un primar pentru
            detalii, bifează ca să compari.
          </>
        }
        tagline={`${primari.length} primari documentați · ${consiliiGenerale.length} mandate de Consiliu General.`}
      />

      {/* Charts overview */}
      <div className="grid lg:grid-cols-2 gap-6 mb-12">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h3 className="font-[family-name:var(--font-sora)] font-semibold text-lg mb-4">
            Durata mandatelor (ani)
          </h3>
          <DurateMandateChart />
        </div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
          <h3 className="font-[family-name:var(--font-sora)] font-semibold text-lg mb-4">
            Compozitia politica a Consiliului General
          </h3>
          <CompozitieCGChart />
        </div>
      </div>

      {/* Interactive primari */}
      <h2 className="font-[family-name:var(--font-sora)] text-3xl font-bold mb-6">
        Primarii generali
      </h2>
      <IstoricInteractive primari={primari} />

      {/* Consilii Generale */}
      <section className="mt-16">
        <h2 className="font-[family-name:var(--font-sora)] text-3xl font-bold mb-8">
          Consilii Generale — compozitie pe mandate
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consiliiGenerale.map((cg) => (
            <div
              key={cg.perioada}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5"
            >
              <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3 font-semibold">
                {cg.perioada}
              </p>
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                {cg.compozitie.map((comp) => (
                  <div
                    key={comp.partid}
                    style={{ width: `${comp.procent}%`, background: comp.culoare }}
                    title={`${comp.partid}: ${comp.procent}%`}
                  />
                ))}
              </div>
              <div className="space-y-1">
                {cg.compozitie.map((comp) => (
                  <div key={comp.partid} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: comp.culoare }}
                      />
                      <span>{comp.partid}</span>
                    </div>
                    <span className="font-medium">{comp.procent}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CountyIstoric({ countyName, countySlug, countyId }: { countyName: string; countySlug: string; countyId: string }) {
  const stats = getCountyStats(countyId);

  return (
    <div className="container-narrow py-8 md:py-12">
      <CountyPageHero
        countyName={countyName}
        countyId={countyId}
        countySlug={countySlug}
        title="Administrație locală"
        icon={History}
        gradient={COUNTY_HERO_GRADIENT.history}
        description={
          <>
            Informații despre conducerea și structura administrativă a
            județului <strong>{countyName}</strong>: primar reședință, consiliu
            județean, prefectură.
          </>
        }
        tagline={`Primar în funcție: ${stats.primarName} (${stats.primarPartid}) · ${stats.populatie.toLocaleString("ro-RO")} locuitori.`}
      />

      {/* Current mayor */}
      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] flex items-center justify-center">
            <Users size={20} />
          </div>
          Primar in functie
        </h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 md:p-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">
                Primar
              </p>
              <p className="text-xl font-bold">{stats.primarName}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{stats.primarPartid}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">
                Populatie
              </p>
              <p className="text-xl font-bold">{stats.populatie.toLocaleString("ro-RO")}</p>
              <p className="text-sm text-[var(--color-text-muted)]">locuitori</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">
                Suprafata
              </p>
              <p className="text-xl font-bold">{stats.suprafataKmp.toLocaleString("ro-RO")} km²</p>
              <p className="text-sm text-[var(--color-text-muted)]">suprafata totala</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1 font-semibold">
                Densitate
              </p>
              <p className="text-xl font-bold">{stats.densitate.toLocaleString("ro-RO")}</p>
              <p className="text-sm text-[var(--color-text-muted)]">loc/km²</p>
            </div>
          </div>
        </div>
      </section>

      {/* Admin structure */}
      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] flex items-center justify-center">
            <Building2 size={20} />
          </div>
          Despre administratia locala
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
            <h3 className="font-[family-name:var(--font-sora)] font-semibold text-lg mb-3">
              Consiliul Judetean
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Consiliul Judetean este autoritatea deliberativa a administratiei publice locale,
              constituita la nivel judetean. Este ales prin vot direct pentru un mandat de 4 ani.
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Coordoneaza activitatea consiliilor locale, aproba bugetul judetean si strategia de
              dezvoltare a judetului.
            </p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
            <h3 className="font-[family-name:var(--font-sora)] font-semibold text-lg mb-3">
              Prefectura
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Prefectul este reprezentantul Guvernului la nivel judetean. Verifica legalitatea
              actelor administrative emise de autoritatile locale.
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Prefectura coordoneaza serviciile publice deconcentrate ale ministerelor si ale
              celorlalte organe ale administratiei centrale.
            </p>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="mb-12">
        <Link
          href={`/${countySlug}/autoritati`}
          className="flex items-center justify-between bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 hover:border-[var(--color-primary)] transition-colors group"
        >
          <div>
            <h3 className="font-semibold mb-1 group-hover:text-[var(--color-primary)] transition-colors">
              Contacte autoritati locale
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Emailuri, telefoane si adrese ale institutiilor publice din {countyName}.
            </p>
          </div>
          <ArrowRight size={20} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors shrink-0 ml-4" />
        </Link>
      </section>

      {/* Coming soon */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-[var(--radius-md)] p-6 flex items-start gap-4">
        <Clock size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm mb-1">In curand</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Istoricul complet al administratiei pentru {countyName} — primari, consilieri si decizii
            importante — va fi disponibil in curand.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function CountyIstoricPage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return null;

  if (county.id === "B") {
    return <BucurestiIstoric />;
  }

  return <CountyIstoric countyName={county.name} countySlug={county.slug} countyId={county.id} />;
}
