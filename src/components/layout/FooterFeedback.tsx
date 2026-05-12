"use client";

import { useState } from "react";
import { MessageSquareMore, Check, Loader2, Bug, Lightbulb, HelpCircle } from "lucide-react";

type Kind = "bug" | "idea" | "question" | "other";

const KIND_META: Record<Kind, { icon: typeof Bug; label: string }> = {
  bug: { icon: Bug, label: "Problemă" },
  idea: { icon: Lightbulb, label: "Sugestie" },
  question: { icon: HelpCircle, label: "Întrebare" },
  other: { icon: MessageSquareMore, label: "Altceva" },
};

/**
 * Compact feedback form at the bottom of the footer.
 *
 * Newsletter signup REMOVED from footer (5/8/2026): user prefera ca
 * inscrierea la newsletter sa se faca DOAR la creare de cont (cu
 * checkbox explicit), nu peste tot in subsol. Vezi AuthModal pentru
 * checkbox-ul de opt-in.
 */
export function FooterFeedback() {
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = async (e: React.FormEvent) => {
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
      const json = await res.json();
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

  return (
    <div
      id="footer-feedback"
      className="mt-10 pt-8 border-t border-[var(--color-border)] scroll-mt-24"
    >
      {/* Feedback only — newsletter removed (signup-only opt-in now).
          Centrat pe ecran (user request 5/12/2026) ca să arate frumos. */}
      <section className="max-w-2xl mx-auto text-center">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <MessageSquareMore size={16} className="text-[var(--color-primary)]" />
          Ce nu-ți place la Civia? Ce lipsește?
        </h4>
        <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
          Platforma se construiește cu tine. Un bug, o idee, o pagină lipsă — orice feedback ajunge direct la mine. Răspund dacă lași un mesaj.
        </p>
        <form onSubmit={submitFeedback} className="space-y-2.5">
          <div className="flex gap-1.5">
            {(Object.keys(KIND_META) as Kind[]).map((k) => {
              const Icon = KIND_META[k].icon;
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 inline-flex items-center justify-center gap-1 h-8 px-2 rounded-[6px] text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]"
                  }`}
                  aria-pressed={active}
                  aria-label={`Categorie feedback: ${KIND_META[k].label}`}
                >
                  <Icon size={12} aria-hidden="true" />
                  <span className="hidden sm:inline">{KIND_META[k].label}</span>
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
            className="w-full min-h-[80px] max-h-60 p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            required
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplu.ro (opțional)"
              autoComplete="email"
              className="flex-1 h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={sending || message.trim().length < 5}
              aria-busy={sending}
              className="h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : done ? <Check size={14} aria-hidden="true" /> : null}
              {sending ? "Se trimite..." : done ? "Mulțumesc!" : "Trimite"}
            </button>
          </div>
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          {done && (
            <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
              <span aria-hidden="true">✓ </span>Mesajul a ajuns. Mersi că te-ai implicat.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
