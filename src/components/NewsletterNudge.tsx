"use client";

import { useEffect, useState } from "react";
import { Mail, X, Check } from "lucide-react";

/**
 * Newsletter signup nudge — apare doar la a 3-a vizită distinct sub
 * forma unui bottom-right toast discret, dispare instant la click pe X.
 * Dismissed = 90 zile no-show, accepted = forever no-show.
 *
 * De ce: signup-ul prin AuthModal (la creare cont) prinde doar utilizatorii
 * loged-in. Vizitatorii anonimi care vor sa fie tinuti la curent nu au
 * acum un path. Newsletter form-ul a fost scos din footer la cererea
 * user-ului 5/8/2026 pentru ca era prea proeminent. Acest nudge e
 * varianta corecta: discret, opt-in dupa engagement repetat.
 *
 * Visit counting: foloseste localStorage civia_visit_count care exista
 * deja (setat de InstallPrompt). Re-foloseste keying-ul ca sa nu
 * duplicam tracking-ul.
 */
const VISIT_COUNT_KEY = "civia_visit_count";
const NUDGE_DISMISS_KEY = "civia_newsletter_nudge_dismissed";
const NUDGE_ACCEPT_KEY = "civia_newsletter_accepted";
const MIN_VISITS_BEFORE_NUDGE = 3;
const DISMISS_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function NewsletterNudge() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already accepted — never show again
    if (localStorage.getItem(NUDGE_ACCEPT_KEY)) return;
    // Recently dismissed
    const dismissedAt = parseInt(localStorage.getItem(NUDGE_DISMISS_KEY) ?? "0", 10);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;
    // Visit count gate
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10);
    if (visitCount < MIN_VISITS_BEFORE_NUDGE) return;
    // Show after delay so it's not jarring on landing
    const t = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(NUDGE_DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) {
      setError("Email invalid");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare");
      localStorage.setItem(NUDGE_ACCEPT_KEY, "1");
      setDone(true);
      setTimeout(() => setVisible(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setSending(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="newsletter-nudge-title"
      className="fixed left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[var(--z-toast)] animate-fade-in-up"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
    >
      <div className="liquid-glass rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-4">
        {done ? (
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-[var(--radius-xs)] bg-emerald-500 grid place-items-center text-white">
              <Check size={18} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-0.5">Te-am adăugat ✓</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Primul mail vine lunea viitoare. Pa!
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0 w-10 h-10 rounded-[var(--radius-xs)] bg-[var(--color-primary)] grid place-items-center text-white">
                <Mail size={18} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  id="newsletter-nudge-title"
                  className="font-semibold text-sm mb-0.5"
                >
                  Te ținem la curent?
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  Un email pe săptămână cu sesizările noi din zona ta — ca să-ți
                  amintești de Civia când vezi ceva pe stradă. Dezabonare cu 1 click.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] -mt-1 -mr-1 p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label="Închide nudge-ul de newsletter"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplu.ro"
                autoComplete="email"
                required
                className="flex-1 h-9 px-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
              <button
                type="submit"
                disabled={sending}
                className="h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
              >
                {sending ? "..." : "Da"}
              </button>
            </form>
            {error && (
              <p role="alert" className="text-[11px] text-red-500 mt-1.5">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
