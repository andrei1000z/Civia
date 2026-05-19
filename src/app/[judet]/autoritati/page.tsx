import type { Metadata } from "next";
import { getCountyBySlug } from "@/data/counties";
import { getCountyStats } from "@/data/statistici-judete";
import {
  PREFECTURI,
  POLITIE,
  PRIMARII,
  POLITIA_LOCALA_JUDET,
  ORASE_IMPORTANTE,
  hasAuthorityData,
} from "@/data/autoritati-contact";
import type { AuthorityContact } from "@/data/autoritati-contact";
import { Building2, Phone, Globe, Mail, MapPin, Users, Bus, Shield } from "lucide-react";
import { CountyPageHero, COUNTY_HERO_GRADIENT } from "@/components/county/CountyPageHero";

// 2026-05-19: ISR 1 saptamana. Autoritatile (primari, prefecturi, telefoane)
// se schimba la electii o data/4 ani. 1 sapt e abundent.
export const revalidate = 604800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ judet: string }>;
}): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return {};
  return {
    title: `Autorități locale — ${county.name}`,
    description: `Autorități locale în ${county.name}: primărie, prefectură, consiliu județean, poliție.`,
    alternates: { canonical: `/${county.slug}/autoritati` },
  };
}

function ContactLinks({ contact }: { contact?: AuthorityContact }) {
  if (!contact) return null;
  const hasAny = contact.phone || contact.email || contact.website || contact.address;
  if (!hasAny) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-[var(--color-border)]">
      {contact.phone && (
        <a
          href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
        >
          <Phone size={14} />
          {contact.phone}
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
        >
          <Mail size={14} />
          {contact.email}
        </a>
      )}
      {contact.website && (
        <a
          href={contact.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
        >
          <Globe size={14} />
          {contact.website.replace("https://", "").replace("http://", "")}
        </a>
      )}
      {contact.address && (
        <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <MapPin size={14} className="shrink-0" />
          {contact.address}
        </span>
      )}
    </div>
  );
}

// Institutional cards for each county
function InstitutionCard({
  name,
  role,
  icon: Icon,
  details,
  contact,
}: {
  name: string;
  role: string;
  icon: React.ElementType;
  details: string[];
  contact?: AuthorityContact;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center">
          <Icon size={20} className="text-[var(--color-primary)]" />
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-sora)] font-semibold text-base">{name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{role}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {details.map((d, i) => (
          <li key={i} className="text-sm text-[var(--color-text-muted)] flex items-start gap-2">
            <span className="text-[var(--color-primary)] mt-0.5">•</span>
            {d}
          </li>
        ))}
      </ul>
      <ContactLinks contact={contact} />
    </div>
  );
}

export default async function AutoritatiPage({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) return null;

  const stats = getCountyStats(county.id);
  const isBucuresti = county.id === "B";
  const hasData = hasAuthorityData(county.id);

  const prefectura = PREFECTURI[county.id];
  const politie = POLITIE[county.id];
  const primarie = PRIMARII[county.id];
  const politialocala = POLITIA_LOCALA_JUDET[county.id];
  const orasImportante = Object.entries(ORASE_IMPORTANTE)
    .filter(([, c]) => c.countyCode === county.id)
    .map(([slug, c]) => ({ slug, ...c }));

  return (
    <div className="container-narrow py-8 md:py-12">
      <CountyPageHero
        countyName={county.name}
        countyId={county.id}
        countySlug={county.slug}
        title="Autorități locale"
        icon={Building2}
        gradient={COUNTY_HERO_GRADIENT.authority}
        description={
          <>
            Instituțiile publice responsabile din <strong>{county.name}</strong>.
            Contactează-le direct sau trimite o sesizare prin Civia — alegem
            instituția competentă pentru tine.
          </>
        }
        tagline={
          stats
            ? `${stats.populatie.toLocaleString("ro-RO")} locuitori · primar reședință: ${stats.primarName} (${stats.primarPartid})`
            : undefined
        }
      />

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <InstitutionCard
          name={isBucuresti ? "Primăria Municipiului București" : `Primăria ${county.name}`}
          role={stats ? `Primar: ${stats.primarName} (${stats.primarPartid})` : "Primărie"}
          icon={Building2}
          contact={primarie}
          details={[
            stats ? `Populație: ${stats.populatie.toLocaleString("ro-RO")} locuitori` : "",
            stats ? `Suprafață: ${stats.suprafataKmp.toLocaleString("ro-RO")} km²` : "",
            `Sesizări: trimite prin secțiunea Sesizări`,
          ].filter(Boolean)}
        />

        <InstitutionCard
          name={isBucuresti ? "Prefectura București" : `Prefectura ${county.name}`}
          role="Instituția Prefectului"
          icon={Building2}
          contact={prefectura}
          details={[
            "Controlul legalității actelor administrative",
            "Situații de urgență la nivel județean",
            "Coordonare servicii publice deconcentrate",
          ]}
        />

        <InstitutionCard
          name={isBucuresti ? "Poliția Capitalei" : `Inspectoratul de Poliție ${county.name}`}
          role="Ministerul Afacerilor Interne"
          icon={Users}
          contact={politie}
          details={[
            "Urgențe: 112",
            "Sesizări non-urgente: trimite prin Civia",
            stats ? `Accidente rutiere 2023: ${stats.accidenteTotal.toLocaleString("ro-RO")}` : "",
          ].filter(Boolean)}
        />

        <InstitutionCard
          name={isBucuresti ? "Poliția Locală București" : `Poliția Locală ${county.name}`}
          role="Subordine locală — primărie"
          icon={Shield}
          contact={politialocala}
          details={[
            "Parcare neregulamentară, trotuar blocat",
            "Liniște publică (zgomot după ora 22:00)",
            "Disciplină construcții, graffiti, mobilier stradal",
            "Cel mai bun destinatar pentru sesizări civice",
          ]}
        />

        <InstitutionCard
          name={stats?.transportPublicOperator ?? "Transport public"}
          role="Operator transport public local"
          icon={Bus}
          details={[
            stats?.hasMetrou ? "Dispune de rețea de metrou (Metrorex)" : "Fără rețea de metrou",
            "Reclamații transport: trimite prin Civia",
            `Categorie sesizare: „Problemă transport public"`,
          ]}
        />

        <InstitutionCard
          name="Agenția pentru Protecția Mediului"
          role={`APM ${county.name}`}
          icon={Globe}
          details={[
            stats ? `AQI mediu: ${stats.aqiMediu} — ${stats.aqiQuality}` : "Monitorizare calitate aer",
            "Raportează poluare: trimite prin Civia",
          ]}
        />

        <InstitutionCard
          name={isBucuresti ? "Consiliul General al Municipiului București" : `Consiliul Județean ${county.name}`}
          role="Autoritate deliberativă"
          icon={MapPin}
          details={[
            "Aprobă bugetul local",
            "Strategie de dezvoltare județeană",
            "Hotărâri de consiliu — consultă site-ul oficial",
          ]}
        />
      </div>

      {orasImportante.length > 0 && (
        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-1">
            Alte orașe din {county.name}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-5">
            Locuiești într-unul din aceste orașe? Trimite sesizarea direct la
            primăria ta — e mai rapid decât să treci prin reședința de județ.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {orasImportante.map((oras) => (
              <div
                id={oras.slug}
                key={oras.slug}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 scroll-mt-24 target:ring-2 target:ring-[var(--color-primary)]"
              >
                <h3 className="font-[family-name:var(--font-sora)] font-semibold text-base mb-1">
                  {oras.name}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  Primărie{oras.politieLocala ? " + Poliție Locală" : ""}
                </p>
                <ContactLinks
                  contact={{
                    phone: oras.phone,
                    email: oras.email,
                    website: oras.website,
                    address: oras.address,
                  }}
                />
                {oras.politieLocala && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1">
                      Poliția Locală
                    </p>
                    <ContactLinks contact={oras.politieLocala} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasData && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-[var(--radius-md)] p-4 text-sm mb-6">
          <p className="text-amber-800 dark:text-amber-300">
            <strong>Notă:</strong> Datele de contact (emailuri, telefoane, site-uri web) ale autorităților sunt în curs de colectare.
            Momentan afișăm informații generale.
          </p>
        </div>
      )}

      <div className="bg-[var(--color-primary-soft)] rounded-[var(--radius-md)] p-6 text-center">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-2">
          Ai o problemă în {county.name}?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Civia generează automat o sesizare formală cu temei legal și o trimite direct la autoritatea competentă.
        </p>
        <a
          href={`/${county.slug}/sesizari`}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Fă o sesizare acum
        </a>
      </div>
    </div>
  );
}
