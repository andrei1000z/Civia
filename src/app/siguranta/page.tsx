import type { Metadata } from "next";
import { ShieldAlert, ExternalLink } from "lucide-react";
import { CRIMINALITATE, TOP_SIGURANTA_JUDETE, DATE_PUBLICE_SNAPSHOT } from "@/data/date-publice";
import { ALL_COUNTIES } from "@/data/counties";
import { Card } from "@/components/ui/Card";
import { SimpleBar } from "@/components/date-publice/SimpleBar";
import { DatasetJsonLd } from "@/components/FaqJsonLd";
import { LastUpdated } from "@/components/data/LastUpdated";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { formatDecimal, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Siguranța pe străzile României — statistici reale",
  description:
    "Infracțiuni sesizate pe categorii și județe, 2019–2024. Cât de sigur e județul tău? Date oficiale Poliția Română, cu contextul pe care nu ți-l dă niciun buletin de știri.",
  alternates: { canonical: "/siguranta" },
};

export const revalidate = 604800;

function countyName(id: string): string {
  return ALL_COUNTIES.find((c) => c.id === id)?.name ?? id;
}

export default function SigurantaPage() {
  const latest = CRIMINALITATE[CRIMINALITATE.length - 1]!;

  return (
    <div className="container-narrow py-8 md:py-12">
      <DatasetJsonLd
        name="Criminalitate România — statistici oficiale"
        description="Date oficiale Poliția Română: tipuri de infracțiuni, evoluție temporală, rate pe județe."
        url="https://civia.ro/siguranta"
        keywords={["criminalitate", "politie", "siguranta", "romania", "statistici"]}
      />
      <PageHero
        title="Cât de sigură e România"
        icon={ShieldAlert}
        gradient={HERO_GRADIENT.warning}
        description={`Infracțiunile înregistrate de Poliția Română, defalcate pe tipuri și județe. Sunt doar cele sesizate oficial — "cifra neagră" a celor neraportate se estimează la 30–50% în funcție de categorie, deci realitatea pe teren e puțin mai gravă.`}
        tagline={`Date Poliția Română + MAI + INS · ${latest.year}: ${formatDecimal(latest.totalInfractiuni / 1000, 0)} mii infracțiuni înregistrate`}
      />

      {/* KEY NUMBERS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Card className="text-center" title={`Total infracțiuni înregistrate în ${latest.year}: ${formatNumber(latest.totalInfractiuni)}`}>
          <div className="text-xs uppercase text-[var(--color-text-muted)] mb-2">Total {latest.year}</div>
          <div className="text-2xl md:text-3xl font-bold text-[var(--color-primary)]">
            {formatDecimal(latest.totalInfractiuni / 1000, 0)} <span className="text-sm font-normal text-[var(--color-text-muted)]">mii</span>
          </div>
        </Card>
        <Card className="text-center" title={`Infracțiuni cu violență (lovituri, vătămări, omor) în ${latest.year}: ${formatNumber(latest.violente)}`}>
          <div className="text-xs uppercase text-[var(--color-text-muted)] mb-2">Violente</div>
          <div className="text-2xl md:text-3xl font-bold text-red-600">
            {formatDecimal(latest.violente / 1000, 1)} <span className="text-sm font-normal text-[var(--color-text-muted)]">mii</span>
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">lovituri · omor · viol</div>
        </Card>
        <Card className="text-center" title={`Infracțiuni de patrimoniu (furt, tâlhărie, înșelăciune) în ${latest.year}: ${formatNumber(latest.patrimoniu)}`}>
          <div className="text-xs uppercase text-[var(--color-text-muted)] mb-2">Patrimoniu</div>
          <div className="text-2xl md:text-3xl font-bold text-amber-600">
            {formatDecimal(latest.patrimoniu / 1000, 0)} <span className="text-sm font-normal text-[var(--color-text-muted)]">mii</span>
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">furt · tâlhărie · înșelăciune</div>
        </Card>
        <Card className="text-center" title={`Trafic și consum droguri în ${latest.year}: ${formatNumber(latest.droguri)}`}>
          <div className="text-xs uppercase text-[var(--color-text-muted)] mb-2">Droguri</div>
          <div className="text-2xl md:text-3xl font-bold text-violet-600">
            {formatDecimal(latest.droguri / 1000, 1)} <span className="text-sm font-normal text-[var(--color-text-muted)]">mii</span>
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">trafic și consum</div>
        </Card>
      </div>

      {/* EVOLUTION */}
      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          Evoluție 2019-2024
        </h2>
        <Card>
          <SimpleBar
            data={CRIMINALITATE.map((c) => ({
              label: String(c.year),
              value: c.totalInfractiuni,
              sub: `${formatDecimal((c.violente / c.totalInfractiuni) * 100, 0)}% violente`,
              color: "#DC2626",
            }))}
            format={(v) => `${formatDecimal(v / 1000, 0)} mii`}
          />
        </Card>
      </section>

      {/* BY TYPE */}
      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          Distribuție pe tipuri ({latest.year})
        </h2>
        <Card>
          <SimpleBar
            data={[
              { label: "Infracțiuni de patrimoniu (furt, tâlhărie)", value: latest.patrimoniu, color: "#F59E0B" },
              { label: "Infracțiuni cu violență", value: latest.violente, color: "#DC2626" },
              { label: "Accidente rutiere cu răniți", value: latest.rutiere, color: "#3B82F6" },
              { label: "Evaziune fiscală", value: latest.evazFiscala, color: "#8B5CF6" },
              { label: "Trafic & consum droguri", value: latest.droguri, color: "#10B981" },
            ]}
            format={(v) => v.toLocaleString("ro-RO")}
          />
        </Card>
      </section>

      {/* BY COUNTY */}
      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">
          Rata infracționalității pe județe (la 1000 locuitori)
        </h2>
        <Card>
          <SimpleBar
            data={TOP_SIGURANTA_JUDETE.sort((a, b) => b.rata - a.rata).map((c) => ({
              label: countyName(c.county),
              value: c.rata,
              sub: c.trend === "up" ? "↑ în creștere" : c.trend === "down" ? "↓ în scădere" : "→ stabil",
              color: c.rata > 35 ? "#DC2626" : c.rata > 25 ? "#F59E0B" : "#10B981",
            }))}
            format={(v) => `${formatDecimal(v, 1)} ‰`}
            max={50}
          />
        </Card>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Rata mai mare NU înseamnă neapărat zonă periculoasă. Bucureștiul concentrează mai
          multe tipuri de infracțiuni fiscale, financiare și rutiere decât alte județe.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-4">Context</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card accentColor="#DC2626">
            <h3 className="font-bold mb-2">Violența domestică — mult sub-raportată</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Doar 1 din 10 cazuri de violență domestică ajunge să fie raportat poliției, conform
              estimărilor ONG-urilor specializate. Numărul real este de aproximativ 10× mai mare
              decât cifrele oficiale.
            </p>
          </Card>
          <Card accentColor="#F59E0B">
            <h3 className="font-bold mb-2">Evaziune fiscală — miliarde de lei</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Deși numărul de infracțiuni de evaziune fiscală pare mic (10k+), valoarea totală a
              prejudiciului depășește 30 mld lei/an. Majoritatea cazurilor se prescriu sau se
              finalizează cu acord.
            </p>
          </Card>
          <Card accentColor="#3B82F6">
            <h3 className="font-bold mb-2">Accidentele rutiere — unde pierdem cei mai mulți</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              România are una dintre cele mai mari rate de mortalitate rutieră din UE — ~95 decese
              la 1 milion locuitori, dublu față de media europeană. Cauze principale: drumuri
              proaste, viteză excesivă, alcool la volan.
            </p>
          </Card>
          <Card accentColor="#10B981">
            <h3 className="font-bold mb-2">Criminalitatea generală — stabilă</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Spre deosebire de percepția publică, totalul infracțiunilor raportate e relativ
              stabil în ultimii 5 ani. Creșterile vizibile sunt mai ales la infracțiunile
              informatice (phishing, fraudă bancară).
            </p>
          </Card>
        </div>
      </section>

      <section className="p-6 rounded-[var(--radius-card)] bg-[var(--color-surface-2)]">
        <h3 className="font-bold mb-3">Surse</h3>
        <ul className="text-sm space-y-2">
          <li>
            <a href="https://www.politiaromana.ro" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1">
              Poliția Română — rapoarte anuale <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a href="https://www.mai.gov.ro" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1">
              Ministerul de Interne — statistici operative <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a href="https://insse.ro" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1">
              INS — populația de referință pentru rate <ExternalLink size={12} />
            </a>
          </li>
        </ul>
      </section>

      <LastUpdated
        date={DATE_PUBLICE_SNAPSHOT.lastUpdated}
        sources={["Poliția Română", "Ministerul de Interne", "INS"]}
      />
    </div>
  );
}
