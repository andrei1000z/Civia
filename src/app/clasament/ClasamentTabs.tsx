"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Delta } from "@/components/ui/Delta";
import { CountUp } from "@/components/ui/CountUp";

type Tab = "primarii" | "zone" | "cetateni";

/**
 * Wrapper subțire client — singura interactivitate a clasamentului. Bara sticky
 * (lc-glass-2, GLASS DOAR aici — chrome) ține KPI-ul național + un <Delta> real
 * (lună-pe-lună, dacă există) + SegmentedControl [Primării · Zone · Cetățeni].
 *
 * Panourile sunt randate pe SERVER (vin ca ReactNode) și toate stau în DOM
 * (inactivele cu `hidden` = display:none) → conținut indexabil SEO, zero JS de
 * randare, doar toggle de vizibilitate.
 */
export function ClasamentTabs({
  nationalScore,
  nationalScoreColor,
  nationalDeltaPct,
  nationalCaption,
  primarii,
  zone,
  cetateni,
}: {
  nationalScore: number;
  nationalScoreColor: string;
  nationalDeltaPct: number | null;
  nationalCaption: string;
  primarii: ReactNode;
  zone: ReactNode;
  cetateni: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("primarii");
  return (
    <>
      <div className="sticky top-2 lg:top-[4.75rem] z-20 mb-8 px-4 py-3 lc-glass-2 rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] hidden sm:inline">
              Național
            </span>
            <span
              className="font-[family-name:var(--font-sora)] text-2xl sm:text-3xl font-extrabold tabular-nums leading-none"
              style={{ color: nationalScoreColor }}
            >
              <CountUp value={nationalScore} />%
            </span>
            {nationalDeltaPct !== null && <Delta value={nationalDeltaPct} showZero={false} />}
            <span className="text-xs text-[var(--color-text-muted)] hidden md:inline truncate">
              {nationalCaption}
            </span>
          </div>
          <SegmentedControl
            options={[
              { value: "primarii", label: "Primării" },
              { value: "zone", label: "Zone" },
              { value: "cetateni", label: "Cetățeni" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            ariaLabel="Vizualizare clasament"
          />
        </div>
      </div>
      <div className={tab === "primarii" ? "" : "hidden"}>{primarii}</div>
      <div className={tab === "zone" ? "" : "hidden"}>{zone}</div>
      <div className={tab === "cetateni" ? "" : "hidden"}>{cetateni}</div>
    </>
  );
}
