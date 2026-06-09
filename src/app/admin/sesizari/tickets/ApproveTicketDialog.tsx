"use client";

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  X as CloseX,
} from "lucide-react";
import {
  SESIZARE_STATUS_META,
  SESIZARE_STATUS_VALUES,
  type SesizareStatus,
} from "@/lib/sesizari/status";
import { useToast } from "@/components/Toast";

interface AssistResponse {
  suggested_status: SesizareStatus;
  suggested_event_at: string | null;
  refined_note: string;
  suggested_decision_note: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface ApproveTicketPayload {
  applied_status: SesizareStatus;
  applied_note: string;
  event_at: string; // ISO 8601
  decision_note: string; // optional, max 500
}

interface Props {
  open: boolean;
  ticket: {
    id: string;
    proposed_status: string;
    note: string;
    proof_url: string | null;
    sesizare: {
      code: string;
      titlu: string;
      status: string;
    } | null;
  } | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ApproveTicketPayload) => void;
}

/**
 * Convert an ISO timestamp into the value format that
 * <input type="datetime-local"> expects: `YYYY-MM-DDTHH:MM` in the
 * browser's LOCAL timezone (no Z, no offset).
 */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Inverse of isoToLocalInput — produces a UTC ISO string. */
function localInputToIso(value: string): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function ApproveTicketDialog({ open, ticket, submitting, onClose, onSubmit }: Props) {
  const { toast } = useToast();
  const [appliedStatus, setAppliedStatus] = useState<SesizareStatus>("in-lucru");
  const [appliedNote, setAppliedNote] = useState("");
  const [eventAtLocal, setEventAtLocal] = useState(""); // datetime-local string
  const [decisionNote, setDecisionNote] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AssistResponse | null>(null);

  // Reset every time the dialog opens with a new ticket. We default
  // status + note to the proposer's values and event_at to "now"; the
  // admin can override anything before submitting.
  useEffect(() => {
    if (!open || !ticket) return;
    const proposed = ticket.proposed_status as SesizareStatus;
    setAppliedStatus(
      (SESIZARE_STATUS_VALUES as readonly string[]).includes(proposed)
        ? proposed
        : "in-lucru",
    );
    setAppliedNote(ticket.note);
    setEventAtLocal(isoToLocalInput(new Date().toISOString()));
    setDecisionNote("");
    setAiResult(null);
  }, [open, ticket]);

  // Esc + body-scroll lock + (audit a11y) focus management: focus inițial în
  // dialog, focus trap pe Tab, restaurare focus pe trigger la închidere.
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)
        : [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) { onClose(); return; }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!, last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [open, submitting, onClose]);

  if (!open || !ticket) return null;

  const runAiAssist = async () => {
    setAiBusy(true);
    try {
      const res = await fetch(
        `/api/admin/status-tickets/${ticket.id}/ai-assist`,
        { method: "POST" },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Eroare AI");
      const data = j.data as AssistResponse;
      setAiResult(data);
      setAppliedStatus(data.suggested_status);
      if (data.refined_note) setAppliedNote(data.refined_note);
      if (data.suggested_event_at) {
        setEventAtLocal(isoToLocalInput(data.suggested_event_at));
      }
      if (data.suggested_decision_note) setDecisionNote(data.suggested_decision_note);
      toast(
        data.warnings.length > 0
          ? `AI a ridicat ${data.warnings.length} avertismente — verifică.`
          : "AI a pre-completat câmpurile.",
        data.warnings.length > 0 ? "info" : "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare AI", "error");
    } finally {
      setAiBusy(false);
    }
  };

  const handleSubmit = () => {
    const note = appliedNote.trim();
    if (note.length < 5) {
      toast("Nota timeline trebuie să aibă cel puțin 5 caractere.", "error");
      return;
    }
    onSubmit({
      applied_status: appliedStatus,
      applied_note: note,
      event_at: localInputToIso(eventAtLocal),
      decision_note: decisionNote.trim(),
    });
  };

  const meta = SESIZARE_STATUS_META[appliedStatus];
  const proposedMeta =
    SESIZARE_STATUS_META[ticket.proposed_status as SesizareStatus] ?? null;
  const statusChanged = appliedStatus !== ticket.proposed_status;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start md:items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-ticket-title"
        className="w-full max-w-3xl bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] border border-[var(--color-border)] my-8 overflow-hidden animate-modal-pop"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" aria-hidden="true" />
            <h3 id="approve-ticket-title" className="font-semibold truncate">
              Aprobă & aplică · <span className="font-mono">{ticket.sesizare?.code ?? "—"}</span>
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={runAiAssist}
              disabled={aiBusy || submitting}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-xs)] bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-500"
              title="Cere AI să citească nota + dovada și să sugereze status / dată / text"
            >
              {aiBusy ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={12} aria-hidden="true" />
              )}
              {aiBusy ? "AI lucrează..." : "Pre-completează cu AI"}
            </button>
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Închide"
            >
              <CloseX size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Sesizare summary */}
          {ticket.sesizare && (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
                Sesizare
              </p>
              <p className="text-sm font-medium leading-snug line-clamp-2">
                {ticket.sesizare.titlu}
              </p>
            </div>
          )}

          {/* AI banner — surfaces confidence + warnings when present */}
          {aiResult && (
            <div
              className={`rounded-[var(--radius-xs)] border p-3 text-xs ${
                aiResult.warnings.length > 0
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                  : "bg-violet-500/10 border-violet-500/30 text-violet-800 dark:text-violet-300"
              }`}
            >
              <p className="font-semibold inline-flex items-center gap-1.5">
                <Sparkles size={12} aria-hidden="true" />
                AI a analizat (încredere: {aiResult.confidence})
              </p>
              {aiResult.warnings.length > 0 && (
                <ul className="mt-1 space-y-1 list-none">
                  {aiResult.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Status picker */}
          <div>
            <p className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
              Status care se va aplica
              {statusChanged && proposedMeta && (
                <span className="ml-2 normal-case text-[var(--color-text-muted)]">
                  · cetățeanul a propus: <strong>{proposedMeta.label}</strong>
                </span>
              )}
            </p>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Selectează statusul aplicat"
            >
              {SESIZARE_STATUS_VALUES.map((s) => {
                const sm = SESIZARE_STATUS_META[s];
                const active = appliedStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setAppliedStatus(s)}
                    className={`text-left p-2.5 rounded-[var(--radius-xs)] text-xs font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 ${
                      active
                        ? "text-white border-transparent"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                    }`}
                    style={active ? { backgroundColor: sm.color } : undefined}
                  >
                    <p className="font-semibold flex items-center gap-1.5">
                      <span aria-hidden="true">{sm.emoji}</span>
                      {sm.label}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 leading-tight normal-case ${
                        active ? "text-white/85" : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {sm.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event timestamp */}
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label
                htmlFor="event-at"
                className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2"
              >
                Data și ora când s-a întâmplat efectiv
                <span className="ml-1 normal-case opacity-70">(va fi data din timeline)</span>
              </label>
              <input
                id="event-at"
                type="datetime-local"
                value={eventAtLocal}
                onChange={(e) => setEventAtLocal(e.target.value)}
                max={isoToLocalInput(new Date().toISOString())}
                className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setEventAtLocal(isoToLocalInput(new Date().toISOString()))}
              className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              title="Pune ora curentă"
            >
              Acum
            </button>
          </div>

          {/* Applied note (timeline-visible) */}
          <div>
            <label
              htmlFor="applied-note"
              className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2"
            >
              Notă publică pentru timeline
              <span className="ml-1 normal-case opacity-70">
                (apare pe pagina sesizării, sub status)
              </span>
            </label>
            <textarea
              id="applied-note"
              value={appliedNote}
              onChange={(e) => setAppliedNote(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Ex: Polițiștii Locali au verificat zona și au amendat 3 mașini parcate ilegal. Confirmare nr. 12345/30.04.2026."
              className="w-full px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {appliedNote.trim().length}/500 — modific direct ce a scris cetățeanul, după
              ce am verificat dovada.
            </p>
          </div>

          {/* Decision note (private to proposer email) */}
          <div>
            <label
              htmlFor="decision-note"
              className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2"
            >
              Notă pentru propunător (opțional)
              <span className="ml-1 normal-case opacity-70">
                · merge în email-ul către cel care a deschis ticket-ul
              </span>
            </label>
            <input
              id="decision-note"
              type="text"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              maxLength={500}
              placeholder={'Ex: Mulțumim, am verificat documentul. / Am ajustat statusul la „Intervenție" pe baza dovezii.'}
              className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2 bg-[var(--color-bg)]">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] text-white text-xs font-semibold disabled:opacity-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
            style={{ backgroundColor: meta.color }}
          >
            {submitting ? (
              <>
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                Aplic...
              </>
            ) : (
              <>
                <CheckCircle2 size={12} aria-hidden="true" />
                Aprobă ca „{meta.label}"
                <ArrowRight size={12} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
