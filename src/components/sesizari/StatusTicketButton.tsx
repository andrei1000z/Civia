"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Flag,
  ShieldAlert,
  X as CloseX,
  XCircle,
} from "lucide-react";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import {
  SESIZARE_STATUS_META,
  SESIZARE_TICKET_PROPOSABLE,
  type SesizareStatus,
} from "@/lib/sesizari/status";
import { bestTextColor } from "@/lib/constants";
import { DocumentUploader } from "./DocumentUploader";

interface Props {
  /** Sesizare code, used in API URLs. */
  code: string;
  /** Current status — we hide it from the proposal list. */
  currentStatus: string;
}

interface TicketRow {
  id: string;
  proposed_status: string;
  note: string;
  proof_url: string | null;
  decision: "pending" | "approved" | "rejected";
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
}

/**
 * Citizen-facing button + modal that lets logged-in users propose a
 * status update on a sesizare. The proposal lands in the admin ticket
 * queue; on approve, the status flips and the timeline is updated.
 */
export function StatusTicketButton({ code, currentStatus }: Props) {
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proposed, setProposed] = useState<SesizareStatus>(
    () => SESIZARE_TICKET_PROPOSABLE.find((s) => s !== currentStatus) ?? "inregistrata",
  );
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TicketRow[] | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // Esc closes + lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Lazy-load the user's prior tickets the first time they open the modal,
  // so they can see the status of past proposals (especially "pending").
  useEffect(() => {
    if (!open || history !== null || !user) return;
    let cancelled = false;
    fetch(`/api/sesizari/${code}/status-tickets`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setHistory((j.data as TicketRow[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, history, user, code]);

  const handleClick = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sesizari/${code}/status-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposed_status: proposed,
          note: note.trim(),
          proof_url: proof,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare la trimitere");
      toast(
        "Propunere trimisă spre aprobare. Te anunțăm când admin-ul decide.",
        "success",
        4500,
      );
      setOpen(false);
      setNote("");
      setProof(null);
      setHistory(null); // bust so reopen reloads
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSubmitting(false);
    }
  };

  const proposable = SESIZARE_TICKET_PROPOSABLE.filter((s) => s !== currentStatus);
  const noteValid = note.trim().length >= 5;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={handleClick}
        leftIcon={<Flag size={16} aria-hidden="true" />}
        className="whitespace-normal text-center leading-tight"
        title="Ai vazut progres in teren sau ai primit raspuns? Raporteaza si admin-ul verifica."
      >
        Ai văzut progres? Raportează
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/55 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => !submitting && setOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-modal-title"
            className="w-full max-w-xl bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] border border-[var(--color-border)] overflow-hidden animate-modal-pop focus:outline-none"
          >
            <div className="bg-gradient-to-r from-[var(--color-primary)] to-cyan-600 text-white p-5 relative">
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Închide"
              >
                <CloseX size={16} aria-hidden="true" />
              </button>
              <h3
                id="ticket-modal-title"
                className="font-[family-name:var(--font-sora)] text-xl font-bold flex items-center gap-2"
              >
                <Flag size={18} aria-hidden="true" />
                Propune un update de status
              </h3>
              <p className="text-sm text-white/85 mt-1">
                Ai văzut intervenție în teren? Ai primit răspuns de la
                primărie? Spune-ne — admin-ul verifică și aplică.
              </p>
            </div>

            <div className="p-5 space-y-5 max-h-[70dvh] overflow-y-auto">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
                  Status propus
                </p>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Selectează statusul propus"
                >
                  {proposable.map((s) => {
                    const meta = SESIZARE_STATUS_META[s];
                    const active = proposed === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setProposed(s)}
                        className={`text-left p-3 rounded-[var(--radius-xs)] border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ${
                          active
                            ? "border-transparent"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                        }`}
                        style={active ? { backgroundColor: meta.color, color: bestTextColor(meta.color) } : undefined}
                      >
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <span aria-hidden="true">{meta.emoji}</span>
                          {meta.label}
                        </p>
                        <p
                          className={`text-[11px] mt-0.5 leading-relaxed ${
                            active ? "opacity-80" : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {meta.hint}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="ticket-note"
                  className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2"
                >
                  Detalii (obligatoriu)
                </label>
                <textarea
                  id="ticket-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Ex: Am primit nr. de înregistrare 12345 / 30.04.2026 prin email de la PMB. / Am văzut că s-au montat stâlpișori azi. / Au venit polițiștii și au amendat 3 mașini."
                  className="w-full px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  {note.trim().length}/1000 — minim 5 caractere
                </p>
              </div>

              <div>
                {proposed === "rezolvat" ? (
                  <div className="rounded-[var(--radius-xs)] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-3 mb-2">
                    <p className="text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                      📸 Poză cu rezolvarea (recomandat)
                    </p>
                    <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                      O poză cu cum arată ACUM (groapa astupată, trotuarul liber, stâlpișorul montat, etc) face propunerea de „rezolvat" mult mai credibilă. Admin-ul aprobă mult mai rapid cu dovadă vizuală.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
                    Dovadă (opțional, dar puternic)
                  </p>
                )}
                <DocumentUploader url={proof} onChange={setProof} />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  {proposed === "rezolvat"
                    ? "Foto „after” cu zona rezolvată — primăria n-o mai poate contesta."
                    : "Poză cu intervenția, captură cu emailul, sau PDF cu răspunsul oficial al instituției."}
                </p>
              </div>

              {history && history.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
                    Propunerile tale anterioare
                  </p>
                  <ul className="space-y-2">
                    {history.slice(0, 5).map((t) => {
                      const meta = SESIZARE_STATUS_META[t.proposed_status as SesizareStatus];
                      const Icon =
                        t.decision === "approved"
                          ? CheckCircle2
                          : t.decision === "rejected"
                          ? XCircle
                          : Clock;
                      const decisionColor =
                        t.decision === "approved"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : t.decision === "rejected"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400";
                      return (
                        <li
                          key={t.id}
                          className="p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs"
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold">{meta?.label ?? t.proposed_status}</span>
                            <span className={`inline-flex items-center gap-1 ${decisionColor}`}>
                              <Icon size={12} aria-hidden="true" />
                              {t.decision === "approved"
                                ? "Aprobat"
                                : t.decision === "rejected"
                                ? "Respins"
                                : "În așteptare"}
                            </span>
                          </div>
                          <p className="text-[var(--color-text-muted)] line-clamp-2">{t.note}</p>
                          {t.decision_note && (
                            <p className="text-[var(--color-text-muted)] italic mt-1">
                              Notă admin: {t.decision_note}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-[var(--radius-xs)] border border-rose-500/30 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                  <ShieldAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2 bg-[var(--color-bg)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => !submitting && setOpen(false)}
              >
                Anulează
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={submitting || !noteValid || proposable.length === 0}
                loading={submitting}
                leftIcon={<Flag size={12} aria-hidden="true" />}
              >
                {submitting ? "Trimit..." : "Trimite propunere"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
