"use client";

import { useState } from "react";
import {
  MessageSquareMore,
  Check,
  Loader2,
  Bug,
  Lightbulb,
  HelpCircle,
} from "lucide-react";

type Kind = "bug" | "idea" | "question" | "other";

const KIND_META: Record<Kind, { icon: typeof Bug; label: string }> = {
  bug: { icon: Bug, label: "Problemă" },
  idea: { icon: Lightbulb, label: "Sugestie" },
  question: { icon: HelpCircle, label: "Întrebare" },
  other: { icon: MessageSquareMore, label: "Altceva" },
};

interface Props {
  /** Headerul afișat deasupra formularului. Default = generic Civia. */
  title?: string;
  description?: string;
  /** Default kind — pe pagini de updateuri/changelog dă sens „idea". */
  defaultKind?: Kind;
  /** Pentru compact mode (sidebar-uri / pagini cu density mare) — fără
   *  border + padding redus. */
  compact?: boolean;
}

/**
 * Form de feedback reutilizabil — POSTează la /api/feedback. Folosit:
 *   - Footer (via FooterFeedback wrapper)
 *   - /updateuri (page-level CTA „spune-ne ce mai vrei")
 *   - oriunde altundeva ai vrea să strângi feedback fără re-implementare.
 */
export function FeedbackBox({
  title = "Ce nu-ți place la Civia? Ce lipsește?",
  description = "Platforma se construiește cu tine. Un bug, o idee, o pagină lipsă — orice feedback ajunge direct la mine. Răspund dacă lași un mesaj.",
  defaultKind = "idea",
  compact = false,
}: Props) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          email: email.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Eroare");
      setDone(true);
      setMessage("");
      setEmail("");
      setTimeout(() => setDone(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setSending(false);
    }
  };

  const wrapperCls = compact
    ? ""
    : "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6";

  return (
    <section className={wrapperCls}>
      <h3 className="font-[family-name:var(--font-sora)] font-bold text-base mb-1.5 flex items-center gap-2">
        <MessageSquareMore size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
        {title}
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
        {description}
      </p>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const Icon = KIND_META[k].icon;
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-[var(--radius-xs)] text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  active
                    ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-1)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]"
                }`}
                aria-pressed={active}
                aria-label={`Categorie feedback: ${KIND_META[k].label}`}
              >
                <Icon size={13} aria-hidden="true" />
                {KIND_META[k].label}
              </button>
            );
          })}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          placeholder={
            kind === "bug"
              ? "Descrie ce nu merge (URL, ce ai încercat, ce ai primit)..."
              : kind === "idea"
                ? "Ce ar merita adăugat sau schimbat?"
                : kind === "question"
                  ? "Scrie întrebarea ta..."
                  : "Scrie mesajul..."
          }
          className="w-full min-h-[100px] max-h-60 p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm leading-relaxed resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          required
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplu.ro (opțional)"
            autoComplete="email"
            className="flex-1 h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={sending || message.trim().length < 5}
            aria-busy={sending}
            className="h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : done ? (
              <Check size={14} aria-hidden="true" />
            ) : null}
            {sending ? "Se trimite..." : done ? "Mulțumesc!" : "Trimite"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-500">
            {error}
          </p>
        )}
        {done && (
          <p
            role="status"
            className="text-xs text-emerald-600 dark:text-emerald-400"
          >
            <span aria-hidden="true">✓ </span>
            Mesajul a ajuns. Mersi că te-ai implicat.
          </p>
        )}
      </form>
    </section>
  );
}
