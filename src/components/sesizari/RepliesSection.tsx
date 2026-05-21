"use client";

import { useEffect, useState } from "react";
import {
  Mail, CheckCircle2, AlertTriangle, Clock, ArrowRight,
  Loader2, ShieldCheck, ShieldAlert, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";

interface Reply {
  id: string;
  from_email: string;
  from_name: string | null;
  authority_id: string | null;
  authority_name: string | null;
  subject: string | null;
  body_text: string | null;
  ai_status: string | null;
  ai_confidence: number | null;
  ai_summary: string | null;
  ai_nr_inregistrare: string | null;
  ai_deadline: string | null;
  ai_suggested_action: string | null;
  auto_applied: boolean;
  user_confirmed: boolean | null;
  user_corrected_status: string | null;
  trusted_sender: boolean;
  received_at: string;
}

interface Props {
  code: string;
  /** True if current viewer is the sesizare owner (can confirm/correct) */
  isOwner: boolean;
}

interface StatusMeta { label: string; color: string; icon: typeof CheckCircle2 }
const STATUS_META: Record<string, StatusMeta> = {
  inregistrata: { label: "Înregistrată", color: "text-blue-600 dark:text-blue-400", icon: CheckCircle2 },
  "in-lucru": { label: "În lucru", color: "text-amber-600 dark:text-amber-400", icon: Clock },
  rezolvat: { label: "Rezolvată", color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  redirectionata: { label: "Redirecționată", color: "text-violet-600 dark:text-violet-400", icon: ArrowRight },
  respins: { label: "Respinsă", color: "text-rose-600 dark:text-rose-400", icon: AlertTriangle },
  cerere_informatii: { label: "Cere informații", color: "text-orange-600 dark:text-orange-400", icon: AlertTriangle },
  necunoscut: { label: "Necunoscut", color: "text-[var(--color-text-muted)]", icon: AlertTriangle },
};
const UNKNOWN_META: StatusMeta = { label: "Necunoscut", color: "text-[var(--color-text-muted)]", icon: AlertTriangle };

const ACTION_LABELS: Record<string, string> = {
  wait_for_resolution: "Așteaptă rezolvarea",
  respond_with_info: "Răspunde cu informațiile cerute",
  escalate_now: "Escaladează acum la Avocatul Poporului",
  confirm_resolution: "Verifică pe teren și confirmă",
  monitor_progress: "Monitorizează progresul",
};

export function RepliesSection({ code, isOwner }: Props) {
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sesizari/${code}/replies`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((j) => {
        if (!cancelled) setReplies((j.data ?? []) as Reply[]);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, [code]);

  if (error) return null; // silent
  if (!replies) {
    return (
      <div
        className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 bg-[var(--color-surface)] animate-pulse"
        aria-busy="true"
      >
        <div className="h-5 w-48 bg-[var(--color-surface-2)] rounded mb-3" />
        <div className="h-16 bg-[var(--color-surface-2)] rounded" />
      </div>
    );
  }
  if (replies.length === 0) return null; // nu afișăm secțiunea dacă n-am primit încă

  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6">
      <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-[var(--radius-xs)] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center"
          aria-hidden="true"
        >
          <Mail size={13} />
        </span>
        Răspunsuri primite ({replies.length})
      </h2>

      <ul className="space-y-3">
        {replies.map((r) => {
          const meta: StatusMeta = STATUS_META[r.ai_status ?? "necunoscut"] ?? UNKNOWN_META;
          const Icon = meta.icon;
          const isExpanded = expanded[r.id] === true;
          const finalStatus = r.user_corrected_status ?? r.ai_status ?? "necunoscut";
          const wasCorrected = r.user_corrected_status && r.user_corrected_status !== r.ai_status;

          return (
            <li
              key={r.id}
              className="border border-[var(--color-border)] rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[var(--color-text)]">
                        {r.authority_name ?? r.from_name ?? r.from_email}
                      </span>
                      {r.trusted_sender ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold uppercase tracking-wider"
                          title="Domeniu instituțional verificat"
                        >
                          <ShieldCheck size={9} aria-hidden="true" /> Verificat
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wider"
                          title="Expeditor neverificat — atenție la conținut"
                        >
                          <ShieldAlert size={9} aria-hidden="true" /> Neverificat
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {r.from_email} ·{" "}
                      {new Date(r.received_at).toLocaleString("ro-RO", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                        timeZone: "Europe/Bucharest",
                      })}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold ${meta.color}`}
                  >
                    <Icon size={12} aria-hidden="true" />
                    {(STATUS_META[finalStatus]?.label ?? meta?.label) || "Necunoscut"}
                  </span>
                </div>

                {/* AI summary */}
                {r.ai_summary ? (
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 mb-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1">
                      <Sparkles size={10} aria-hidden="true" />
                      Rezumat AI
                      {r.ai_confidence !== null ? (
                        <span className="ml-1 opacity-70">({r.ai_confidence}% încredere)</span>
                      ) : null}
                    </div>
                    <p className="text-sm text-[var(--color-text)] leading-snug">{r.ai_summary}</p>
                    {r.ai_nr_inregistrare ? (
                      <p className="mt-1.5 text-xs">
                        <span className="text-[var(--color-text-muted)]">Nr. înregistrare oficial: </span>
                        <strong className="font-mono">{r.ai_nr_inregistrare}</strong>
                      </p>
                    ) : null}
                    {r.ai_deadline ? (
                      <p className="mt-1 text-xs">
                        <span className="text-[var(--color-text-muted)]">Termen menționat: </span>
                        <strong>{r.ai_deadline}</strong>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Suggested action */}
                {r.ai_suggested_action && ACTION_LABELS[r.ai_suggested_action] ? (
                  <div className="text-xs text-[var(--color-text-muted)] mb-2">
                    💡 Sugestie:{" "}
                    <strong className="text-[var(--color-text)]">
                      {ACTION_LABELS[r.ai_suggested_action]}
                    </strong>
                  </div>
                ) : null}

                {/* Owner controls — confirm / correct */}
                {isOwner && r.user_confirmed === null && !r.auto_applied ? (
                  <OwnerControls replyId={r.id} aiStatus={r.ai_status ?? "necunoscut"} />
                ) : null}
                {wasCorrected ? (
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-1 italic">
                    Userul a corectat clasificarea AI de la „{STATUS_META[r.ai_status ?? "necunoscut"]?.label}" la „{STATUS_META[finalStatus]?.label}".
                  </div>
                ) : null}

                {/* Toggle full body */}
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline focus:outline-none"
                >
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {isExpanded ? "Ascunde textul" : "Arată textul integral"}
                </button>
              </div>

              {/* Full body */}
              {isExpanded ? (
                <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 max-h-80 overflow-y-auto">
                  <div className="text-xs text-[var(--color-text-muted)] mb-2 font-semibold">
                    Subject: {r.subject ?? "(fără subiect)"}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-sans text-[var(--color-text)] leading-relaxed">
                    {r.body_text ?? "(corp gol)"}
                  </pre>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OwnerControls({ replyId, aiStatus }: { replyId: string; aiStatus: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"confirmed" | "corrected" | null>(null);

  const send = async (action: "confirm" | "correct", correctedStatus?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/inbox/reply/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "confirm"
            ? { user_confirmed: true }
            : { user_confirmed: false, user_corrected_status: correctedStatus },
        ),
      });
      if (res.ok) setDone(action === "confirm" ? "confirmed" : "corrected");
    } finally {
      setBusy(false);
    }
  };

  if (done === "confirmed") {
    return (
      <div className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mt-2">
        <CheckCircle2 size={12} /> Mulțumesc — clasificarea a fost confirmată.
      </div>
    );
  }
  if (done === "corrected") {
    return (
      <div className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mt-2">
        <CheckCircle2 size={12} /> Mulțumesc — clasificarea a fost corectată. AI învață.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => send("confirm")}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-xs)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
        Confirm clasificarea
      </button>
      <details className="inline-block">
        <summary className="cursor-pointer text-xs text-[var(--color-primary)] hover:underline list-none">
          Corectează →
        </summary>
        <div className="mt-2 flex flex-wrap gap-1">
          {(Object.entries(STATUS_META) as [string, { label: string }][])
            .filter(([k]) => k !== aiStatus && k !== "necunoscut")
            .map(([key, m]) => (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => send("correct", key)}
                className="text-[11px] px-2 py-1 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] disabled:opacity-50"
              >
                {m.label}
              </button>
            ))}
        </div>
      </details>
    </div>
  );
}
