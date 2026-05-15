"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Send, Loader2, Check } from "lucide-react";

type Topic = "gdpr" | "bug" | "idee" | "contact" | "altele";

interface FeedbackFormProps {
  /** Setat dacă vrei să forțezi un topic (ex: pe pagina GDPR e "gdpr"). */
  defaultTopic?: Topic;
  /** Hint personalizat pentru textarea. */
  placeholder?: string;
  /** Titlu pentru success state. */
  successTitle?: string;
  /** Compact = fără border, fără padding mare (pentru embed inline). */
  compact?: boolean;
}

const TOPIC_LABELS: Record<Topic, string> = {
  gdpr: "Date personale / GDPR",
  bug: "Bug / problemă tehnică",
  idee: "Sugestie / idee nouă",
  contact: "Contact general",
  altele: "Altceva",
};

export function FeedbackForm({
  defaultTopic = "contact",
  placeholder = "Scrie liber — întrebare, observație, sugestie. Răspundem dacă lași un email opțional mai jos.",
  successTitle = "Mulțumim pentru mesaj!",
  compact = false,
}: FeedbackFormProps) {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>(defaultTopic);
  const [honey, setHoney] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (text.trim().length < 10) {
      setError("Scrie cel puțin 10 caractere.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          email: email.trim() || undefined,
          topic,
          page_path: pathname,
          _honey: honey,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare trimitere");
      setSubmitted(true);
      setText("");
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare trimitere");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className={
          compact
            ? "flex items-start gap-3 py-3"
            : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-[var(--radius-md)] p-5 flex items-start gap-3"
        }
      >
        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Check size={18} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm mb-0.5">{successTitle}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Mesajul tău a fost trimis. Dacă ai lăsat email, primești răspuns
            în 24-48h.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-2 text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            Trimite alt mesaj →
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handle}
      className={
        compact
          ? "space-y-3"
          : "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 space-y-4"
      }
    >
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Subiect
        </label>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as Topic)}
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {(Object.keys(TOPIC_LABELS) as Topic[]).map((t) => (
            <option key={t} value={t}>
              {TOPIC_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="fb-text" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Mesaj <span className="text-red-500">*</span>
        </label>
        <textarea
          id="fb-text"
          required
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 3000))}
          placeholder={placeholder}
          rows={5}
          aria-describedby="fb-text-hint"
          aria-invalid={text.length > 0 && text.trim().length < 10}
          className="w-full px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] resize-y min-h-[110px]"
        />
        <p
          id="fb-text-hint"
          className={`text-[11px] mt-1 tabular-nums ${
            text.length > 0 && text.trim().length < 10
              ? "text-amber-600 dark:text-amber-400"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {text.length}/3000 · minim 10 caractere
          {text.length > 0 && text.trim().length < 10 && (
            <> · mai ai {10 - text.trim().length} de scris</>
          )}
        </p>
      </div>

      <div>
        <label htmlFor="fb-email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Email <span className="font-normal normal-case text-[var(--color-text-muted)]">(opțional, ca să te putem contacta înapoi)</span>
        </label>
        <input
          id="fb-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nume@exemplu.ro"
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
      </div>

      {/* Honeypot */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honey}
        onChange={(e) => setHoney(e.target.value)}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
      />

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-[var(--radius-xs)] px-3 py-2"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || text.trim().length < 10}
        aria-busy={submitting}
        className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
        {submitting ? "Se trimite..." : "Trimite mesaj"}
      </button>
    </form>
  );
}
