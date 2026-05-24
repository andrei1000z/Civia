import type { Metadata } from "next";
import { Map as MapIcon, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "Roadmap Civia • Ce urmează",
  description: "Roadmap public — ce am livrat, ce urmează, ce visăm pentru Civia.",
  alternates: { canonical: `${SITE_URL}/roadmap` },
};

export const revalidate = 86400;

interface Item {
  title: string;
  description: string;
  status: "done" | "active" | "planned" | "dream";
  quarter?: string;
}

const ROADMAP: Item[] = [
  // DONE
  { status: "done", title: "Sesizări AI-formalizate", description: "Template determinist + AI Vision auto-route pe poză", quarter: "Q1 2026" },
  { status: "done", title: "Petiții civice agregate", description: "Sincronizare Declic, Avaaz, etc.", quarter: "Q1 2026" },
  { status: "done", title: "Știri AI-sintetizate", description: "14+ surse RSS, 3 fetch-uri/oră", quarter: "Q1 2026" },
  { status: "done", title: "Cron auto-reminders 7/14/30/60 zile", description: "OG 27/2002 compliance", quarter: "Q1 2026" },
  { status: "done", title: "AVP escalation generator", description: "Auto-plângere la 60 zile", quarter: "Q2 2026" },
  { status: "done", title: "/impact dashboard public", description: "Transparență cu cifre reale", quarter: "Q2 2026" },
  { status: "done", title: "Open311 v2 API", description: "GeoReport standard pentru civic tech apps", quarter: "Q2 2026" },
  { status: "done", title: "Civic Streak gamification", description: "Streak counter pe profil + leaderboard", quarter: "Q2 2026" },
  { status: "done", title: "AI Pattern Detection (cron weekly)", description: "Groq detectează systemic issues", quarter: "Q2 2026" },
  { status: "done", title: "WCAG 2.2 AA conformity", description: "Touch targets, ARIA, focus rings", quarter: "Q2 2026" },
  { status: "done", title: "Dark mode locked", description: "Niciun toggle, single UX path", quarter: "Q2 2026" },
  { status: "done", title: `Newsletter weekly „Rezolvate" cron`, description: "Friday digest cu top 5 reparate", quarter: "Q2 2026" },

  // ACTIVE
  { status: "active", title: "Authority Portal MVP", description: "Primării se loghează + răspund inline", quarter: "Q3 2026" },
  { status: "active", title: "AI severity score", description: "Vision atribuie automat low/medium/high/critical", quarter: "Q3 2026" },
  { status: "active", title: "Sesizare → Petition pipeline", description: "Cosign >50 → propune petition automat", quarter: "Q3 2026" },
  { status: "active", title: "E2E test suite Playwright", description: "Critical flows + visual regression", quarter: "Q3 2026" },

  // PLANNED
  { status: "planned", title: "Mobile app PWA install prompt", description: "Push notifications native", quarter: "Q4 2026" },
  { status: "planned", title: "SDK JavaScript public", description: "npm install @civia/sdk pentru integrare", quarter: "Q4 2026" },
  { status: "planned", title: "Multi-language UI", description: "Maghiară (RO minority), engleză (diaspora)", quarter: "Q4 2026" },
  { status: "planned", title: "AI Authority Response Quality Score", description: "Detectare boilerplate vs răspuns real", quarter: "Q4 2026" },
  { status: "planned", title: "Bilateral satisfaction rating", description: "Primaria evaluează cetățean (anonim), cetățean evaluează primaria", quarter: "Q4 2026" },
  { status: "planned", title: "Email-to-sesizare", description: "Trimite poză la submit@civia.ro → auto-create", quarter: "Q4 2026" },

  // DREAMS
  { status: "dream", title: "Politicieni Hub", description: "Scorecard public consilieri local/judetean", quarter: "2027" },
  { status: "dream", title: "Election Compass", description: "Promisiuni candidați → tracking post-mandate", quarter: "2027" },
  { status: "dream", title: "Civia Schools", description: "Kit civic literacy profesori liceu", quarter: "2027" },
  { status: "dream", title: "Civia Audio (podcast)", description: "Săptămânal interview primari răspunzători", quarter: "2027" },
];

export default function RoadmapPage() {
  const grouped = {
    done: ROADMAP.filter((r) => r.status === "done"),
    active: ROADMAP.filter((r) => r.status === "active"),
    planned: ROADMAP.filter((r) => r.status === "planned"),
    dream: ROADMAP.filter((r) => r.status === "dream"),
  };

  return (
    <>
      <PageHero
        title="Roadmap Civia"
        icon={MapIcon}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Ce am livrat, ce lucrăm acum, ce planificăm. <strong>Roadmap public</strong> —
            ai feedback? <a href="mailto:roadmap@civia.ro" className="underline">Scrie-ne</a>.
          </>
        }
        tagline={`${grouped.done.length} livrate · ${grouped.active.length} în lucru · ${grouped.planned.length} planificate`}
      />

      <div className="container-narrow space-y-8 pb-16 max-w-3xl">
        <Group title="✅ Livrate (live în prod)" items={grouped.done} accent="emerald" />
        <Group title="🚧 În lucru acum" items={grouped.active} accent="amber" />
        <Group title="📋 Planificate" items={grouped.planned} accent="cyan" />
        <Group title="✨ Visăm să facem (long-term)" items={grouped.dream} accent="violet" />

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-8">
          Roadmap-ul e public, dar nu setat în piatră. Prioritățile se schimbă în funcție de
          feedback comunitate + resurse disponibile (Civia e volunteer-run).
        </p>
      </div>
    </>
  );
}

function Group({
  title,
  items,
  accent,
}: {
  title: string;
  items: Item[];
  accent: "emerald" | "amber" | "cyan" | "violet";
}) {
  if (items.length === 0) return null;
  const accentClass = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  }[accent];
  const iconColor = {
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    cyan: "text-cyan-500",
    violet: "text-violet-500",
  }[accent];
  const Icon = accent === "emerald" ? CheckCircle2 : accent === "amber" ? Clock : Sparkles;
  return (
    <section>
      <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-3">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.title}
            className={`rounded-[var(--radius-md)] border p-4 ${accentClass}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Icon size={16} className={`mt-0.5 ${iconColor} shrink-0`} aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
              {item.quarter && (
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono shrink-0 tabular-nums">
                  {item.quarter}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
