"use client";

import { useEffect, useState } from "react";
import { MapPin, Trash2, Loader2 } from "lucide-react";
import { areaLabel } from "@/lib/area/subscriptions";
import { useToast } from "@/components/Toast";

interface AreaSub {
  id: string;
  county: string;
  locality: string | null;
  category: string | null;
  email_optin: boolean;
  push_optin: boolean;
}

/**
 * „Zone urmărite" (Faza 2) — listă + dezabonare, în /cont. Client self-contained
 * (fetch GET /api/area/follow). Ascuns dacă userul n-are nicio abonare.
 */
export function AreaSubscriptionsManager() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<AreaSub[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/area/follow")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { subscriptions?: AreaSub[] } | null) => {
        if (!cancelled) setSubs(json?.subscriptions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSubs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/area/follow?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubs((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
        toast("Dezabonat de la zonă", "success", 2000);
      } else {
        toast("Nu am putut dezabona", "error");
      }
    } catch {
      toast("Eroare de rețea", "error");
    } finally {
      setRemoving(null);
    }
  }

  // Nimic de afișat dacă încă încarcă sau nu există abonări.
  if (!subs || subs.length === 0) return null;

  return (
    <section className="min-w-0 rounded-3xl lc-glass-2 p-4 sm:p-5">
      <h2 className="text-sm font-bold mb-1 inline-flex items-center gap-1.5">
        <MapPin size={15} className="text-[var(--color-primary)]" aria-hidden="true" />
        Zone urmărite
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Primești un digest săptămânal cu ce s-a întâmplat în zonele tale.
      </p>
      <ul className="space-y-2">
        {subs.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-2"
          >
            <span className="text-sm font-medium text-[var(--color-text)] truncate">
              {areaLabel(s)}
              {s.push_optin && (
                <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">· push</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => remove(s.id)}
              disabled={removing === s.id}
              aria-label={`Nu mai urmări ${areaLabel(s)}`}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {removing === s.id ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={13} aria-hidden="true" />
              )}
              Dezabonează
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
