import type { Metadata } from "next";
import { Coins, ExternalLink, Vote, Users, ShieldQuestion } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { PROGRAME_BP } from "@/data/bugetare-programe";
import { CerereBPGenerator } from "@/components/bugetare/CerereBPGenerator";
import { PrioritatiOras } from "@/components/bugetare/PrioritatiOras";
import { getCountyById } from "@/data/counties";

export const metadata: Metadata = {
  title: "Bugetare participativă — unde există și cum o ceri pentru orașul tău",
  description:
    "Ghidul Civia pentru bugetarea participativă din România: orașele cu programe oficiale, cum participi, și un generator de cerere formală (OG 27/2002) ca să o ceri pentru orașul tău.",
  alternates: { canonical: "/bugetare-participativa" },
};

export const revalidate = 86400;

const FAPTE = [
  {
    icon: Vote,
    titlu: "Tu propui, tu votezi",
    text: "O cotă din bugetul local e alocată proiectelor propuse și votate direct de cetățeni: parcuri, piste, mobilitate, spații publice.",
  },
  {
    icon: Users,
    titlu: "Funcționează din 2017",
    text: "Cluj-Napoca derulează programul din 2017, pe platformă dedicată. Mai multe orașe l-au preluat — altele l-au suspendat.",
  },
  {
    icon: ShieldQuestion,
    titlu: "Nu există? Se poate cere",
    text: "Primăria e obligată să răspundă în 30 de zile oricărei petiții (OG 27/2002). Cererea formală de mai jos e un început.",
  },
];

export default function BugetareParticipativaPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Bugetare participativă"
        description="Unde poți decide direct cum se cheltuie o parte din bugetul orașului — și cum o ceri formal acolo unde programul nu există (încă)."
        icon={Coins}
        gradient={HERO_GRADIENT.data}
        tagline="Banul public, cu semnătura cetățeanului"
      />

      <main>
        {/* Ce e */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3 stagger-children">
          {FAPTE.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.titlu}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]"
              >
                <Icon size={18} className="mb-2 text-[var(--color-primary)]" aria-hidden="true" />
                <h3 className="mb-1 text-sm font-bold text-[var(--color-text)]">{f.titlu}</h3>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{f.text}</p>
              </div>
            );
          })}
        </div>

        {/* Programe oficiale */}
        <section className="mb-10">
          <h2 className="mb-1 text-base font-bold text-[var(--color-text)]">
            Programe oficiale cunoscute
          </h2>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Calendarele se schimbă anual — verifică ediția curentă pe platforma oficială a fiecărui
            oraș. Multe orașe și-au suspendat sau redus programele în ultimii ani.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {PROGRAME_BP.map((p) => (
              <a
                key={p.id}
                href={p.platformaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)] card-lift hover:border-[var(--color-primary)]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                    {p.oras}
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {getCountyById(p.county)?.name ?? p.county}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{p.descriere}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
                  <ExternalLink size={12} aria-hidden="true" />
                  Platforma oficială
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Prioritățile orașului — iterația 2 (buget umbră): propui + votezi,
            topul se transmite formal primăriei de către Civia. */}
        <section className="mb-10">
          <h2 className="mb-1 text-base font-bold text-[var(--color-text)]">
            Prioritățile orașului tău — propune și votează
          </h2>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            Ce ar trebui să finanțeze primăria mai întâi? Propune o investiție, votează maximum 3
            priorități (cont necesar — un vot de om, nu de robot). Civia transmite periodic topul,
            formal, primăriei — cu temei OG 27/2002 și răspuns obligatoriu în 30 de zile.
          </p>
          <PrioritatiOras />
        </section>

        {/* Generatorul — absența devine acțiune */}
        <section className="mb-10">
          <h2 className="mb-1 text-base font-bold text-[var(--color-text)]">
            Orașul tău nu are program? Cere-l formal
          </h2>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            Generează o petiție în temeiul OG 27/2002 — primăria e obligată să răspundă în 30 de
            zile. Cu cât cer mai mulți cetățeni, cu atât mai greu de ignorat.
          </p>
          <CerereBPGenerator />
        </section>

        {/* Simulatorul educațional — cârligul viral către date */}
        <section className="mb-10 rounded-[var(--radius-md)] border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5">
          <h2 className="mb-1 text-base font-bold text-[var(--color-text)]">
            🎮 Tu cum ai împărți bugetul?
          </h2>
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">
            Joc de 90 de secunde: împarte bugetul orașului pe categorii, apoi compară cu alocarea
            reală a primăriei. Spoiler: diferența ta cea mai mare e exact locul unde merită să acționezi.
          </p>
          <a
            href="/bugetare-participativa/simulator"
            className="btn-press inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-1)] hover:opacity-90 transition"
          >
            Joacă simulatorul →
          </a>
        </section>

        <p className="text-xs text-[var(--color-text-muted)]">
          Index curatoriat manual de Civia — corecturi sau programe lipsă:{" "}
          <a href="mailto:contact@civia.ro" className="font-semibold text-[var(--color-primary)] underline">
            contact@civia.ro
          </a>
          .
        </p>
      </main>
    </div>
  );
}
