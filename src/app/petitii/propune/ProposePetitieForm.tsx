"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check, ArrowLeft, ExternalLink } from "lucide-react";

/**
 * Formular minimal: link obligatoriu + un rând de context. Mesajul ajunge
 * via /api/feedback (kind="idea" cu prefix „[Petiție propusă]" în corp)
 * direct în /admin/feedback. Nu necesită schemă DB nouă, nu necesită
 * cont — orice utilizator poate propune.
 */
export function ProposePetitieForm() {
  const [url, setUrl] = useState("");
  const [context, setContext] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    if (!/^https?:\/\//.test(url.trim())) {
      setError("Link-ul trebuie să înceapă cu http:// sau https://");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const message = `[Petiție propusă]\n\nLink: ${url.trim()}\n\nContext: ${context.trim() || "(fără context suplimentar)"}`;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "idea",
          message,
          email: email.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare");
      setDone(true);
      setUrl("");
      setContext("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-[var(--radius-md)] p-6 text-center">
        <Check size={32} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-3" aria-hidden="true" />
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-2">
          Mulțumim — propunerea a ajuns la noi.
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
          Verificăm petiția în 1-2 ore (uneori mai repede). Dacă e civică și
          activă, o adăugăm în catalog. Dacă lași email mai sus, te anunțăm
          când e publicată.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/petitii"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Înapoi la petiții
          </Link>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
          >
            Mai propun una
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <div>
        <label htmlFor="petitie-url" className="block text-sm font-medium mb-1.5">
          Link către petiție <span className="text-red-500">*</span>
        </label>
        <input
          id="petitie-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://campaniamea.declic.ro/..."
          autoComplete="off"
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          required
        />
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 inline-flex items-center gap-1">
          <ExternalLink size={11} aria-hidden="true" />
          Declic, Avaaz, change.org, petitiononline.ro — orice platformă publică.
        </p>
      </div>

      <div>
        <label htmlFor="petitie-context" className="block text-sm font-medium mb-1.5">
          Despre ce e? (opțional)
        </label>
        <textarea
          id="petitie-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          maxLength={500}
          placeholder="Pe scurt: ce cere petiția, către cine, de ce e importantă. (Maxim 500 caractere.)"
          className="w-full min-h-[100px] max-h-60 p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
          {context.length}/500 caractere
        </p>
      </div>

      <div>
        <label htmlFor="petitie-email" className="block text-sm font-medium mb-1.5">
          Email tău (opțional)
        </label>
        <input
          id="petitie-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ca să te anunțăm când e publicată"
          autoComplete="email"
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={sending || !url.trim()}
          aria-busy={sending}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          {sending ? "Se trimite..." : "Trimite propunerea"}
        </button>
        <Link
          href="/petitii"
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Înapoi la petiții
        </Link>
      </div>
    </form>
  );
}
