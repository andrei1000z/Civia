"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Shuffle, Zap } from "lucide-react";

interface CountyOption {
  id: string;
  name: string;
  slug: string;
}

// Quick-pick preset-uri — combinații populare pe care user-ii le caută
// constant. Scutesc 2 click-uri pe dropdown-uri.
const PRESETS: { label: string; a: string; b: string; emoji: string }[] = [
  { label: "București vs Cluj", a: "b", b: "cj", emoji: "🏙️" },
  { label: "Cluj vs Iași", a: "cj", b: "is", emoji: "🎓" },
  { label: "Constanța vs Brașov", a: "ct", b: "bv", emoji: "🏖️" },
  { label: "Timișoara vs Cluj", a: "tm", b: "cj", emoji: "💼" },
  { label: "Sibiu vs Brașov", a: "sb", b: "bv", emoji: "⛰️" },
  { label: "Iași vs Galați", a: "is", b: "gl", emoji: "🌊" },
];

export function CompareCountyPicker({ counties }: { counties: CountyOption[] }) {
  const [a, setA] = useState<string>(counties[0]?.slug ?? "b");
  const [b, setB] = useState<string>(counties[1]?.slug ?? "cj");

  const sameCounty = a === b;
  const href = sameCounty ? "/compara" : `/compara/${a}/${b}`;

  // Filter the second dropdown so the user can't pick the same
  // county twice from the UI side. They *can* still match via the
  // first dropdown's onChange, so the button-level guard below is
  // the last line of defence.
  const countiesForB = counties.filter((c) => c.slug !== a);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div>
          <label htmlFor="county-a" className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Județul A
          </label>
          <select
            id="county-a"
            value={a}
            onChange={(e) => {
              const next = e.target.value;
              setA(next);
              // Avoid the same-county trap by bouncing B to the
              // first different option if the user steers A into B.
              if (next === b) {
                const alternative = counties.find((c) => c.slug !== next);
                if (alternative) setB(alternative.slug);
              }
            }}
            className="w-full h-12 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {counties.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>

        <div className="text-2xl text-center text-[var(--color-text-muted)] self-center sm:pb-2" aria-hidden="true">
          vs
        </div>

        <div>
          <label htmlFor="county-b" className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Județul B
          </label>
          <select
            id="county-b"
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="w-full h-12 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {countiesForB.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <Link
        href={href}
        prefetch={!sameCounty}
        aria-disabled={sameCounty}
        aria-describedby={sameCounty ? "compare-warning" : undefined}
        tabIndex={sameCounty ? -1 : 0}
        onClick={(e) => { if (sameCounty) e.preventDefault(); }}
        className={`mt-6 inline-flex items-center justify-center gap-2 w-full h-12 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] ${
          sameCounty ? "opacity-50 pointer-events-none cursor-not-allowed" : "hover:bg-[var(--color-primary-hover)]"
        }`}
      >
        Compară <ArrowRight size={18} aria-hidden="true" />
      </Link>

      {sameCounty && (
        <p id="compare-warning" role="alert" className="mt-2 text-xs text-amber-600 dark:text-amber-400 text-center">
          Alege două județe diferite pentru comparație.
        </p>
      )}

      {/* Quick presets — combinații populare ca să sari direct */}
      <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3 inline-flex items-center gap-1.5">
          <Zap size={11} aria-hidden="true" /> Populare
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <Link
              key={`${p.a}-${p.b}`}
              href={`/compara/${p.a}/${p.b}`}
              prefetch={false}
              className="group flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-colors text-xs"
            >
              <span aria-hidden="true">{p.emoji}</span>
              <span className="font-medium group-hover:text-[var(--color-primary)] transition-colors">
                {p.label}
              </span>
            </Link>
          ))}
        </div>

        {/* „Surprinde-mă" — random pair, util pentru jurnaliști care
            caută inspirație. Folosește Math.random() la click-time
            ca server-ul să livreze SSR consistent. */}
        <button
          type="button"
          onClick={() => {
            const i = Math.floor(Math.random() * counties.length);
            let j = Math.floor(Math.random() * counties.length);
            while (j === i) j = Math.floor(Math.random() * counties.length);
            const aSlug = counties[i]?.slug;
            const bSlug = counties[j]?.slug;
            if (aSlug && bSlug) {
              window.location.href = `/compara/${aSlug}/${bSlug}`;
            }
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-bg)] hover:border-[var(--color-primary)]/40 transition-colors"
        >
          <Shuffle size={12} aria-hidden="true" />
          Surprinde-mă cu o pereche aleatorie
        </button>
      </div>
    </div>
  );
}
