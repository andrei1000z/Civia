import type { Metadata } from "next";
import { Target, TrendingUp, CheckCircle2 } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";

const SITE_URL = "https://civia.ro";

export const metadata: Metadata = {
  title: "OKRs publice • Civia",
  description:
    "Obiectivele și rezultatele cheie Civia pentru 2026. Public, transparent, măsurabil.",
  alternates: { canonical: `${SITE_URL}/okrs` },
};

export const revalidate = 86400;

interface KeyResult {
  text: string;
  progress: number; // 0-100
  status: "on-track" | "at-risk" | "achieved" | "not-started";
}

interface Objective {
  title: string;
  description: string;
  results: KeyResult[];
}

const OKRS_Q3_2026: Objective[] = [
  {
    title: "Creștem rata de trimitere oficială a sesizărilor",
    description: "În Q2 2026: doar 6% sesizări erau efectiv trimise via Civia. Atins prin: SendViaCiviaButton vizibil anonim + email magic link + UX flow simplificat.",
    results: [
      { text: "Rata trimitere efectivă: 6% → 40%", progress: 30, status: "on-track" },
      { text: "Anonimii pot trimite oficial (magic link verify)", progress: 100, status: "achieved" },
      { text: "Default SuccessScreen = TRIMITE primar, mailto secundar", progress: 100, status: "achieved" },
    ],
  },
  {
    title: "Obținem primele răspunsuri de la primării",
    description: "Cele 3 sesizări trimise via Civia (00044, 00046, 00047) sunt în termen OG 27/2002. Q3 — obținem 5+ răspunsuri.",
    results: [
      { text: "5+ sesizări cu răspuns autoritate", progress: 0, status: "on-track" },
      { text: "AVP escalation generator activ la 60 zile", progress: 100, status: "achieved" },
      { text: "Authority Response Quality Score deployed", progress: 100, status: "achieved" },
    ],
  },
  {
    title: "Atragem primăria pilot prin Authority Portal",
    description: "Prima primărie verificată + activă pe portalul Civia.",
    results: [
      { text: "1 primărie sector București verifică contul", progress: 0, status: "on-track" },
      { text: "DPA template + landing /autoritati disponibile", progress: 100, status: "achieved" },
      { text: "Răspuns inline în portal funcțional", progress: 50, status: "at-risk" },
    ],
  },
  {
    title: "Lansăm comunitatea publică (transparență)",
    description: "Pagini publice care comunică valori, progress, decizii.",
    results: [
      { text: "/civic-pulse + /impact + /status live", progress: 100, status: "achieved" },
      { text: "/roadmap public + /okrs (asta!) + /civia-finance", progress: 80, status: "on-track" },
      { text: "10+ cetățeni activi (civic_streak > 7)", progress: 5, status: "at-risk" },
    ],
  },
  {
    title: "Compliance audit complet WCAG + GDPR",
    description: "Pre-EAA în vigoare 28 iunie 2025 — Civia conformă.",
    results: [
      { text: "WCAG 2.2 AA: touch targets, ARIA, focus, contrast", progress: 95, status: "on-track" },
      { text: "Declarație /legal/accesibilitate complete", progress: 100, status: "achieved" },
      { text: "Audit extern pen-test", progress: 0, status: "not-started" },
    ],
  },
];

export default function OkrsPage() {
  const totalKRs = OKRS_Q3_2026.reduce((sum, o) => sum + o.results.length, 0);
  const achieved = OKRS_Q3_2026.flatMap((o) => o.results).filter((r) => r.status === "achieved").length;
  const avgProgress = Math.round(
    OKRS_Q3_2026.flatMap((o) => o.results).reduce((sum, r) => sum + r.progress, 0) / totalKRs,
  );

  return (
    <>
      <PageHero
        title="OKRs publice"
        icon={Target}
        gradient={HERO_GRADIENT.data}
        description={
          <>
            Obiectivele și rezultatele cheie ale Civia. <strong>Public, transparent, măsurabil.</strong>
            Actualizat lunar.
          </>
        }
        tagline={`Q3 2026 · ${achieved}/${totalKRs} KRs atinse · ${avgProgress}% progres mediu`}
      />

      <div className="container-narrow space-y-6 pb-16 max-w-3xl">
        {OKRS_Q3_2026.map((obj, i) => (
          <section key={i} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-7">
            <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-2">
              O{i + 1}: {obj.title}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">{obj.description}</p>
            <div className="space-y-3">
              {obj.results.map((kr, j) => (
                <KrRow key={j} num={`KR${i + 1}.${j + 1}`} kr={kr} />
              ))}
            </div>
          </section>
        ))}

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-6">
          Următoarea actualizare: 1 august 2026. Vezi și{" "}
          <a href="/roadmap" className="text-[var(--color-primary)] hover:underline">roadmap-ul</a>{" "}
          public + <a href="/impact" className="text-[var(--color-primary)] hover:underline">cifre live</a>.
        </p>
      </div>
    </>
  );
}

function KrRow({ num, kr }: { num: string; kr: KeyResult }) {
  const colorMap = {
    "on-track": { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "On track" },
    "at-risk": { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "At risk" },
    "achieved": { bg: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300", label: "✓ Atins" },
    "not-started": { bg: "bg-slate-400", text: "text-slate-500", label: "Nepornit" },
  }[kr.status];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm">
          <span className="font-mono text-xs text-[var(--color-text-muted)]">{num}</span>{" "}
          {kr.text}
        </p>
        <span className={`text-xs font-semibold ${colorMap.text}`}>{colorMap.label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div className={`h-full ${colorMap.bg} transition-all`} style={{ width: `${kr.progress}%` }} />
      </div>
      <p className="text-[10px] text-[var(--color-text-muted)] text-right tabular-nums">
        {kr.progress}%
      </p>
    </div>
  );
}
