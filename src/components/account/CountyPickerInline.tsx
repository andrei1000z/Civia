"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Check } from "lucide-react";
import { ALL_COUNTIES } from "@/data/counties";

const COUNTY_LS_KEY = "civia_county";

/**
 * Inline county switcher for /cont. Reads/writes the same localStorage
 * key + cookie used by CountyPicker on the homepage so the persistence
 * stays in sync across surfaces. On change we router.refresh() so any
 * server-rendered nav links pick up the new selection on the next render.
 */
export function CountyPickerInline() {
  const router = useRouter();
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(COUNTY_LS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSlug(raw ? raw.toLowerCase() : null);
  }, []);

  const sortedCounties = [...ALL_COUNTIES].sort((a, b) =>
    a.name.localeCompare(b.name, "ro"),
  );

  const handleChange = (slug: string) => {
    if (typeof window === "undefined") return;
    if (!slug) {
      // "Național" — clear localStorage and the cookie so the
      // src/proxy.ts "come home to your county" redirect on / stops
      // bouncing the user to /[slug]. We use BOTH max-age=0 and
      // expires=epoch defensively because some browsers/CDN caches
      // ignore one but not the other, and we set both with-and-
      // without SameSite so we don't accidentally write a different
      // cookie attribute set than the original.
      localStorage.removeItem(COUNTY_LS_KEY);
      const expired = "Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = `county=; path=/; max-age=0; expires=${expired}; SameSite=Lax`;
      document.cookie = `county=; path=/; max-age=0; expires=${expired}`;
      setSavedSlug(null);
    } else {
      localStorage.setItem(COUNTY_LS_KEY, slug);
      document.cookie = `county=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      setSavedSlug(slug);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  };

  const currentCounty = savedSlug
    ? ALL_COUNTIES.find((c) => c.slug === savedSlug)
    : null;

  return (
    <div className="space-y-2">
      <label
        htmlFor="county-select"
        className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
      >
        Județul tău
      </label>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <MapPin
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-primary)] pointer-events-none"
            aria-hidden="true"
          />
          <select
            id="county-select"
            value={savedSlug ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full h-10 pl-9 pr-8 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <option value="">🇷🇴 Național</option>
            {sortedCounties.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
        {saved && (
          <span
            role="status"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Check size={12} aria-hidden="true" />
            Salvat
          </span>
        )}
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        {currentCounty ? (
          <>
            Calitatea aerului, întreruperile, știrile și statisticile vor fi filtrate pentru{" "}
            <strong>{currentCounty.name}</strong>. Sesizările, petițiile și ghidurile rămân naționale.{" "}
            <Link href={`/${currentCounty.slug}`} className="text-[var(--color-primary)] hover:underline">
              Vezi pagina județului →
            </Link>
          </>
        ) : (
          <>
            Vei vedea conținutul național.{" "}
            <Link href="/" className="text-[var(--color-primary)] hover:underline">
              Mergi pe homepage →
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
