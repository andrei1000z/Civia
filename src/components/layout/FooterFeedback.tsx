"use client";

import { useState } from "react";
import { MessageSquareMore, Check, Loader2 } from "lucide-react";

/**
 * Compact feedback form at the bottom of the footer.
 *
 * Newsletter signup REMOVED from footer (5/8/2026): user prefera ca
 * inscrierea la newsletter sa se faca DOAR la creare de cont (cu
 * checkbox explicit), nu peste tot in subsol. Vezi AuthModal pentru
 * checkbox-ul de opt-in.
 *
 * 5/23/2026: scoatem picker-ul de categorie (Problemă/Sugestie/Întrebare/
 * Altceva) — user clasifică natural în textul mesajului.
 */
export function FooterFeedback() {
  const kind = "idea" as const; // default backend hint; admin re-clasifică
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
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            placeholder="Scrie mesajul tău — bug, idee, întrebare, orice fel de feedback..."
            className="w-full min-h-[80px] max-h-60 p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            required
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              inputMode="email"
              enterKeyHint="send"
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
