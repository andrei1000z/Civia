"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AvpReason } from "@/lib/sesizari/escalation";

/**
 * Escaladare la Avocatul Poporului (Faza 1) — buton author-only.
 *
 * Eligibilitatea (timp legal) e calculată server-side și pasată ca prop. Dacă
 * nu e eligibilă, butonul e disabled cu hint onest (NU sugerăm că co-semnăturile
 * grăbesc termenul). Pe eligibil → modal de confirmare (explică OG 27/2002 art. 8)
 * → POST /escalate-avp. Serverul rămâne autoritatea finală (poate respinge cu 422).
 */
export function EscalateAvpButton({
  code,
  eligible,
  reason,
  daysUntilEligible,
}: {
  code: string;
  eligible: boolean;
  reason: AvpReason;
  daysUntilEligible: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open, busy]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sesizari/${code}/escalate-avp`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Eroare ${res.status}`);
        return;
      }
      setDone(true);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Eroare de rețea. Mai încearcă.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Check size={13} aria-hidden="true" />
        Plângere trimisă către Avocatul Poporului (avp@avp.ro)
      </p>
    );
  }

  // Hint onest când nu e eligibilă încă.
  const hint =
    reason === "responded"
      ? "Autoritatea a răspuns oficial — termenul legal a fost respectat."
      : reason === "resolved"
        ? "Sesizarea e închisă."
        : `Disponibil după ce termenul legal expiră (în ${daysUntilEligible} ${daysUntilEligible === 1 ? "zi" : "zile"}).`;

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => eligible && setOpen(true)}
        disabled={!eligible}
        title={!eligible ? hint : undefined}
        leftIcon={<Scale size={14} aria-hidden="true" />}
      >
        Escaladează la Avocatul Poporului
      </Button>
      {!eligible && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">{hint}</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => !busy && setOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avp-title"
            className="w-full max-w-md bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] my-8 max-h-[calc(100dvh-4rem)] overflow-y-auto animate-modal-pop"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h2 id="avp-title" className="font-bold text-base inline-flex items-center gap-2">
                <Scale size={16} className="text-amber-600" aria-hidden="true" />
                Escaladare la Avocatul Poporului
              </h2>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Închide"
                className="w-8 h-8 rounded-full hover:bg-[var(--color-surface-2)] flex items-center justify-center transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="p-5">
              <p className="text-sm text-[var(--color-text)] leading-relaxed mb-3">
                Termenul legal de răspuns (OG 27/2002) a expirat fără ca autoritatea
                să răspundă. Conform art. 8, ai dreptul să sesizezi{" "}
                <strong>Avocatul Poporului</strong>.
              </p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4">
                Civia generează plângerea cu datele tale și o trimite la{" "}
                <strong>avp@avp.ro</strong>. AVP răspunde direct la tine (primești și o
                copie). Trimiterea e definitivă.
              </p>
              {error && (
                <p className="text-xs text-red-500 mb-3" role="alert">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Anulează
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  disabled={busy}
                  loading={busy}
                  leftIcon={<Scale size={14} aria-hidden="true" />}
                >
                  Trimite plângerea
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
