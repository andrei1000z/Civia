import type { Metadata } from "next";
import { Code2, Mail, Calendar, Trophy } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Civic Hackathons • Civia",
  description:
    "Civia susține și organizează civic tech hackathons în România. Vezi evenimente upcoming + cum să propui un hackathon nou.",
  alternates: { canonical: `${SITE_URL}/hackathons` },
};

export const revalidate = 86400;

interface Hackathon {
  status: "upcoming" | "past" | "proposal";
  title: string;
  date: string;
  location: string;
  description: string;
  participants?: string;
  url?: string;
}

const HACKATHONS: Hackathon[] = [
  {
    status: "proposal",
    title: "Civia DevDay 2026",
    date: "Q4 2026 (TBD)",
    location: "București",
    description: "Open-source contributors zi de hacking pe issues Civia. Hosting în pregătire.",
  },
  {
    status: "proposal",
    title: "FOSS4G Europe Civic Track",
    date: "29 iunie - 3 iulie 2026",
    location: "Timișoara",
    description: "Co-organizat cu echipa FOSS4G — civic geospatial. Civia track pentru participanți. Vorbim cu organizatorii.",
    url: "https://2026.europe.foss4g.org/",
  },
  {
    status: "proposal",
    title: "Open Government Hackathon",
    date: "2027 Q1 (TBD)",
    location: "Cluj-Napoca",
    description: "În discuție cu Open Government Partnership Romania + data.gov.ro.",
  },
];

export default function HackathonsPage() {
  const upcoming = HACKATHONS.filter((h) => h.status === "upcoming");
  const proposals = HACKATHONS.filter((h) => h.status === "proposal");
  const past = HACKATHONS.filter((h) => h.status === "past");

  return (
    <>
      <PageHero
        title="Civic Hackathons"
        icon={Code2}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Civia susține și organizează <strong>civic tech hackathons</strong> în România. Vrei să
            construiești ceva care contează? Aici găsești evenimente upcoming.
          </>
        }
        tagline={`${upcoming.length} upcoming · ${proposals.length} propuneri · ${past.length} trecute`}
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        {upcoming.length > 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3 flex items-center gap-2">
              <Calendar size={20} className="text-[var(--color-primary)]" aria-hidden="true" />
              Upcoming
            </h2>
            <div className="space-y-3">
              {upcoming.map((h) => <HackathonCard key={h.title} h={h} accent="emerald" />)}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3 flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" aria-hidden="true" />
            În discuție
          </h2>
          <div className="space-y-3">
            {proposals.map((h) => <HackathonCard key={h.title} h={h} accent="amber" />)}
          </div>
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3 flex items-center gap-2">
              <Code2 size={20} className="text-[var(--color-text-muted)]" aria-hidden="true" />
              Trecute
            </h2>
            <div className="space-y-3">
              {past.map((h) => <HackathonCard key={h.title} h={h} accent="slate" />)}
            </div>
          </section>
        )}

        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
          <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3">
            🚀 Propune un hackathon
          </h2>
          <p className="text-sm mb-3">
            Vrei să organizezi un civic hackathon? Civia poate fi sponsor + mentor + furnizor de
            challenges (probleme reale din baza de date). Cerere:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mb-4">
            <li>Locație + dată propusă (minim 8 săptămâni avans)</li>
            <li>Audiență țintă (studenți / dev profesionali / mixt)</li>
            <li>Estimativ participanți</li>
            <li>Buget total (Civia poate sponsoriza parțial)</li>
            <li>Co-organizatori (universitate, ONG, companie tech)</li>
          </ul>
          <a
            href="mailto:hackathons@civia.ro?subject=Propunere%20hackathon"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Mail size={16} aria-hidden="true" />
            hackathons@civia.ro
          </a>
        </section>

        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
          <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-3">
            💡 Challenge ideas pentru hackathons
          </h2>
          <ul className="list-disc list-inside space-y-1.5 text-sm">
            <li>App PWA mobile dedicată pentru raportare cu camera AI</li>
            <li>Visualizare 3D cluster systemic issues (Three.js + Civia API)</li>
            <li>WhatsApp/Telegram bot pentru submit sesizare</li>
            <li>Voice-to-sesizare Alexa skill / Google Assistant action</li>
            <li>AR overlay sesizari pe stradă (mobile camera)</li>
            <li>Dashboard primării alternative (mai bun decât /admin/primarie)</li>
            <li>SDK Python pentru data scientists civic</li>
            <li>Streamlit app pentru jurnaliști — query data + create rapoarte</li>
            <li>Chrome extension highlight problems on Google Maps</li>
          </ul>
        </section>
      </div>
    </>
  );
}

function HackathonCard({ h, accent }: { h: Hackathon; accent: "emerald" | "amber" | "slate" }) {
  const accentClass = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    slate: "border-[var(--color-border)] bg-[var(--color-surface-2)]",
  }[accent];
  return (
    <div className={`rounded-[var(--radius-md)] border p-4 ${accentClass}`}>
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <h3 className="font-semibold text-base">{h.title}</h3>
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{h.date}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-2">{h.location}</p>
      <p className="text-sm leading-relaxed">{h.description}</p>
      {h.url && (
        <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-primary)] hover:underline">
          Mai multe →
        </a>
      )}
    </div>
  );
}
