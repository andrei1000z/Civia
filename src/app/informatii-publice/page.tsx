import type { Metadata } from "next";
import Link from "next/link";
import { Scale, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Cerere544Generator } from "@/components/legea544/Cerere544Generator";
import { SITE_NAME } from "@/lib/constants";
import {
  TERMEN_544_ZILE,
  TERMEN_544_COMPLEX_ZILE,
  TERMEN_544_REFUZ_ZILE,
} from "@/lib/legea544/template";

export const metadata: Metadata = {
  title: "Cerere de informații publice (Legea 544/2001) — generator gratuit",
  description:
    "Generează în 1 minut o cerere oficială de informații de interes public către orice autoritate din România, în temeiul Legii 544/2001. Gratuit, cu temei legal și termene incluse.",
  alternates: { canonical: "/informatii-publice" },
};

const FAPTE: Array<{ icon: typeof Clock; titlu: string; text: string }> = [
  {
    icon: Clock,
    titlu: `Răspuns în ${TERMEN_544_ZILE} zile`,
    text: `Autoritatea trebuie să răspundă în ${TERMEN_544_ZILE} zile, sau ${TERMEN_544_COMPLEX_ZILE} de zile pentru informații complexe (cu înștiințare la ${TERMEN_544_ZILE} zile).`,
  },
  {
    icon: ShieldCheck,
    titlu: "Dreptul tău, gratuit",
    text: "Orice persoană poate cere informații de interes public, fără să justifice de ce. Accesul e gratuit (se pot percepe doar costuri de copiere).",
  },
  {
    icon: AlertTriangle,
    titlu: "Refuzul se motivează",
    text: `Un refuz trebuie motivat în scris și comunicat în ${TERMEN_544_REFUZ_ZILE} zile. Poți face plângere la instanță sau reclamație la conducătorul instituției.`,
  },
];

export default function InformatiiPublicePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHero
        title="Cere informații publice"
        description="Generează o cerere oficială în temeiul Legii 544/2001 către orice primărie, consiliu sau instituție — cu temei legal și termene incluse."
        icon={Scale}
        gradient={HERO_GRADIENT.authority}
        tagline="Transparența e un drept, nu un favor"
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        {/* Fapte cheie */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
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

        <Cerere544Generator />

        {/* Notă + legătură către ghid */}
        <div className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-muted)]">
          <p>
            <strong className="text-[var(--color-text)]">Cum funcționează:</strong> completezi cui trimiți și ce vrei să afli,
            iar {SITE_NAME} construiește automat textul oficial cu temeiul legal corect. Îl copiezi sau îl trimiți direct pe e-mail.
            Vrei mai multe detalii despre drepturile tale?{" "}
            <Link href="/ghiduri/ghid-legea-544" className="font-semibold text-[var(--color-primary)] underline">
              Citește ghidul Legea 544
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
