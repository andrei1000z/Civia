import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Clock, ArrowRight } from "lucide-react";
import { ghiduri } from "@/data/ghiduri";
import { Badge } from "@/components/ui/Badge";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { BreadcrumbJsonLd } from "@/components/FaqJsonLd";
import { SITE_URL } from "@/lib/constants";

const TOTAL = ghiduri.length;

export const metadata: Metadata = {
  title: "Ghiduri practice — ce să faci când statul e dificil",
  description: `${TOTAL} ghiduri pas-cu-pas pentru cetățeni: Legea 544, contestarea unei amenzi, ajutoare sociale, cum înființezi un ONG, drepturi și proceduri explicate simplu — fără jargon juridic.`,
  alternates: { canonical: "/ghiduri" },
};

export const revalidate = 86400;

const dificultateMap = {
  usor: { label: "Ușor", variant: "success" as const },
  mediu: { label: "Mediu", variant: "warning" as const },
  avansat: { label: "Avansat", variant: "accent" as const },
};

export default function GhiduriPage() {
  return (
    <div className="lc-canvas lc-canvas--flat">
    <div className="container-narrow py-8 md:py-12">
      <BreadcrumbJsonLd
        items={[
          { name: "Acasă", url: SITE_URL },
          { name: "Ghiduri", url: `${SITE_URL}/ghiduri` },
        ]}
      />
      {/* PageHero card pattern — aliniat cu /petitii, /proteste,
          /intreruperi (user request 5/12/2026, „standarde Civia UI"). */}
      <PageHero
        title="Ce să faci când te lovești de stat"
        icon={BookOpen}
        gradient={HERO_GRADIENT.petition}
        description={
          <>
            <strong>{TOTAL} ghiduri scurte</strong>, cu pași concreți. Contestarea
            unei amenzi, cererea de informații publice, înființarea unui ONG,
            pregătirea pentru cutremur — lucrurile pe care nu le înveți la
            școală dar pe care toți le înfruntăm.
          </>
        }
        tagline="Pas cu pas, fără jargon juridic — totul explicat simplu, cu link-uri către sursele oficiale."
      />

      <section aria-label="Listă ghiduri civice">
        <div className="lc-stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {ghiduri.map((ghid, idx) => (
              <Link
                key={ghid.id}
                href={`/ghiduri/${ghid.slug}`}
                className="group lc-glass-2 rounded-3xl overflow-hidden card-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                aria-label={`${ghid.titlu} — ${dificultateMap[ghid.dificultate].label}, ${ghid.timpCitire} minute citire, ${ghid.capitole} capitole`}
              >
                <div className={`relative h-48 bg-gradient-to-br ${ghid.gradient} overflow-hidden`}>
                  {ghid.image && (
                    <>
                      {/* Primele 3 carduri (above-the-fold pe desktop) sunt
                          LCP candidate — eager + fetchpriority high. Restul
                          raman lazy. Analytics 2026-05-13: /ghiduri LCP poor
                          33% deoarece toate imaginile erau lazy = LCP astepta
                          dupa toate scripturile. */}
                      {/* audit fix: next/image (fill + srcset responsiv + AVIF/WebP
                          redimensionat) în loc de raw <img> → reduce payload-ul LCP
                          (era ~600KB). */}
                      <Image
                        src={`/images/ghiduri/${ghid.image}.webp`}
                        alt=""
                        fill
                        sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        priority={idx === 0}
                        loading={idx === 0 ? undefined : idx < 3 ? "eager" : "lazy"}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    </>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-7xl relative z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                      {ghid.icon}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={dificultateMap[ghid.dificultate].variant}>
                      {dificultateMap[ghid.dificultate].label}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Clock size={12} aria-hidden="true" />
                      <span className="tabular-nums">{ghid.timpCitire}</span> min
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-sora)] font-semibold text-xl mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                    {ghid.titlu}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-3">
                    {ghid.descriere}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                      <BookOpen size={14} aria-hidden="true" />
                      <span className="tabular-nums">{ghid.capitole}</span> {ghid.capitole === 1 ? "capitol" : "capitole"}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] group-hover:gap-2 transition-all">
                      Citește
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </section>
    </div>
    </div>
  );
}
