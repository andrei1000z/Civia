"use client";

import { useEffect, useState } from "react";
import { Sparkles, Eye, Type, Activity, PlusSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Aspect & accesibilitate — panou de preferințe device-level (NU cont).
 *
 * Best-of-Both design system:
 * - Slider „intensitatea sticlei" → `--glass-intensity` (0→1) conduce alfa+blur
 *   pe TOATE straturile lc-glass. Mai mic = mai opac + lizibil; mai mare = frost.
 * - Toggles a11y → clase pe <html> (citite + de boot-script înainte de paint):
 *   reduce-transparency (sticlă opacă), larger-text, reduce-motion, signs.
 * Persistă în localStorage (civia-glass-intensity, civia-a11y-*).
 */

const GLASS_KEY = "civia-glass-intensity";
const GLASS_DEFAULT = 0.45;

type ToggleKey = "reduce-transparency" | "larger-text" | "reduce-motion" | "signs";

const TOGGLES: { key: ToggleKey; label: string; desc: string; icon: typeof Eye }[] = [
  {
    key: "reduce-transparency",
    label: "Redu transparența",
    desc: "Suprafețele de sticlă devin opace — contrast maxim, lizibilitate garantată.",
    icon: Eye,
  },
  {
    key: "larger-text",
    label: "Text mai mare",
    desc: "Mărește textul în toată aplicația cu ~12%.",
    icon: Type,
  },
  {
    key: "reduce-motion",
    label: "Redu mișcarea",
    desc: "Oprește tranzițiile și animațiile (peste setarea sistemului).",
    icon: Activity,
  },
  {
    key: "signs",
    label: "Arată mereu semnele",
    desc: "Afișează +/− și săgeți lângă culori, pentru daltonism. Culoarea nu e niciodată singurul semnal.",
    icon: PlusSquare,
  },
];

function clampGlass(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : GLASS_DEFAULT;
}

export function AppearanceSettings() {
  const [glass, setGlass] = useState(GLASS_DEFAULT);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    "reduce-transparency": false,
    "larger-text": false,
    "reduce-motion": false,
    signs: false,
  });

  // Hidratează din storage pe mount (boot-script-ul a aplicat deja pe <html>;
  // aici doar sincronizăm UI-ul cu starea reală).
  useEffect(() => {
    try {
      const g = localStorage.getItem(GLASS_KEY);
      if (g !== null) setGlass(clampGlass(Number(g)));
      setToggles({
        "reduce-transparency": localStorage.getItem("civia-a11y-reduce-transparency") === "1",
        "larger-text": localStorage.getItem("civia-a11y-larger-text") === "1",
        "reduce-motion": localStorage.getItem("civia-a11y-reduce-motion") === "1",
        signs: localStorage.getItem("civia-a11y-signs") === "1",
      });
    } catch {
      /* storage blocat — rămân default */
    }
  }, []);

  function applyGlass(v: number) {
    const c = clampGlass(v);
    setGlass(c);
    document.documentElement.style.setProperty("--glass-intensity", String(c));
    try {
      localStorage.setItem(GLASS_KEY, String(c));
    } catch {
      /* noop */
    }
  }

  function applyToggle(k: ToggleKey, on: boolean) {
    setToggles((p) => ({ ...p, [k]: on }));
    document.documentElement.classList.toggle("a11y-" + k, on);
    try {
      localStorage.setItem("civia-a11y-" + k, on ? "1" : "0");
    } catch {
      /* noop */
    }
  }

  const glassPct = Math.round(glass * 100);
  const transparencyOff = toggles["reduce-transparency"];

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-1)] p-4 sm:p-5 space-y-5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <h2 className="font-[family-name:var(--font-sora)] text-base font-bold text-[var(--color-text)] m-0">
          Aspect & accesibilitate
        </h2>
      </div>

      {/* Temă — light / system / dark (mutat din footer 2026-06-18) */}
      <div>
        <label className="text-sm font-semibold text-[var(--color-text)]">Temă</label>
        <ThemeToggle variant="segmented" className="mt-2" />
      </div>

      {/* Glass intensity slider */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="glass-intensity" className="text-sm font-semibold text-[var(--color-text)]">
            Intensitatea sticlei
          </label>
          <span className="num-tabular text-sm font-bold text-[var(--color-primary)] tabular-nums">
            {transparencyOff ? "oprită" : `${glassPct}%`}
          </span>
        </div>
        <input
          id="glass-intensity"
          type="range"
          min={0}
          max={100}
          step={5}
          value={glassPct}
          disabled={transparencyOff}
          onChange={(e) => applyGlass(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Intensitatea sticlei"
        />
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
          {transparencyOff
            ? `Dezactivat cât timp „Redu transparența” e pornit.`
            : `Mai puțin = mai opac și mai lizibil. Mai mult = efect frost (sticlă mată). Lizibilitatea textului nu depinde niciodată de ce se vede în spate.`}
        </p>
      </div>

      {/* A11y toggles */}
      <div className="divide-y divide-[var(--color-border)]">
        {TOGGLES.map((t) => {
          const Icon = t.icon;
          const checked = toggles[t.key];
          return (
            <div key={t.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 shrink-0 text-[var(--color-text-muted)]">
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`a11y-${t.key}`}
                  className="block text-sm font-semibold text-[var(--color-text)]"
                >
                  {t.label}
                </label>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {t.desc}
                </p>
              </div>
              <button
                id={`a11y-${t.key}`}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={t.label}
                onClick={() => applyToggle(t.key, !checked)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
                  checked
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                )}
              >
                <span
                  className={cn(
                    "inline-block size-4 rounded-full bg-white shadow-[var(--shadow-1)] transition-transform duration-200",
                    checked ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
