"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Flame, Droplets, Zap, Users as UsersIcon, Building2, Car, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Eveniment, EvenimentCategory, EvenimentSeverity } from "@/types";

const categoryIcons: Record<EvenimentCategory, React.ElementType> = {
  accident: Car,
  incendiu: Flame,
  inundatie: Droplets,
  cutremur: Zap,
  protest: UsersIcon,
  infrastructura: Building2,
};

const categoryLabels: Record<EvenimentCategory, string> = {
  accident: "Accident",
  incendiu: "Incendiu",
  inundatie: "Inundații",
  cutremur: "Cutremur",
  protest: "Protest",
  infrastructura: "Infrastructură",
};

const severityColors: Record<EvenimentSeverity, string> = {
  minor: "#84CC16",
  moderat: "#EAB308",
  major: "#F97316",
  critic: "#DC2626",
};

const severityLabels: Record<EvenimentSeverity, string> = {
  minor: "Minor",
  moderat: "Moderat",
  major: "Major",
  critic: "Critic",
};

const ALL_CATEGORIES: EvenimentCategory[] = ["accident", "incendiu", "inundatie", "cutremur", "protest", "infrastructura"];

export function EvenimenteFilter({ evenimente }: { evenimente: Eveniment[] }) {
  const [category, setCategory] = useState<EvenimentCategory | "toate">("toate");

  const filtered = category === "toate"
    ? evenimente
    : evenimente.filter((ev) => ev.category === category);

  return (
    <>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filtrează după categorie">
        <button
          type="button"
          onClick={() => setCategory("toate")}
          aria-pressed={category === "toate"}
          className={cn(
            "px-4 py-2 rounded-[var(--radius-pill)] text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
            category === "toate"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
          )}
        >
          Toate ({evenimente.length})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = evenimente.filter((ev) => ev.category === cat).length;
          if (count === 0) return null;
          const Icon = categoryIcons[cat];
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={cn(
                "px-4 py-2 rounded-[var(--radius-pill)] text-xs font-medium transition-all inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                category === cat
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <Icon size={12} aria-hidden="true" />
              {categoryLabels[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((ev) => {
          const Icon = categoryIcons[ev.category];
          return (
            <Link
              key={ev.id}
              href={`/evenimente/${ev.slug}`}
              className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] transition-all"
            >
              <div className={`relative h-48 bg-gradient-to-br ${ev.gradient} overflow-hidden`}>
                {ev.image ? (
                  <>
                    <Image
                      src={`/images/evenimente/${ev.image}.webp`}
                      alt={ev.titlu}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-grid-pattern opacity-10" />
                    <Icon size={64} strokeWidth={1.2} className="text-white/40 relative z-10" />
                  </div>
                )}
                <div className="absolute top-3 left-3 z-10">
                  <Badge bgColor="rgba(0,0,0,0.5)" color="white" className="text-[10px]">
                    {categoryLabels[ev.category]}
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3 z-10">
                  <Badge bgColor={severityColors[ev.severity]} color="white" className="text-[10px]">
                    {severityLabels[ev.severity]}
                  </Badge>
                </div>
              </div>
              <div className="p-5">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {formatDate(ev.data)}
                </p>
                <h3 className="font-[family-name:var(--font-sora)] font-semibold text-base mb-2 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                  {ev.titlu}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3">
                  {ev.descriere}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)] pt-3 border-t border-[var(--color-border)]">
                  {ev.victime !== undefined && ev.victime > 0 && <span>{ev.victime} {ev.victime === 1 ? "victimă" : "victime"}</span>}
                  {ev.evacuati !== undefined && ev.evacuati > 0 && <span>{ev.evacuati} {ev.evacuati === 1 ? "evacuat" : "evacuați"}</span>}
                  <span className="ml-auto flex items-center gap-1 text-[var(--color-primary)] font-medium">
                    Detalii <ArrowRight size={12} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)] mb-3">
            Niciun eveniment în categoria „{categoryLabels[category as EvenimentCategory] ?? "selectată"}”.
          </p>
          <button
            type="button"
            onClick={() => setCategory("toate")}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Vezi toate evenimentele
          </button>
        </div>
      )}
    </>
  );
}
