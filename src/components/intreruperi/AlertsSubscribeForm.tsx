"use client";

import { useState, useEffect } from "react";
import { Mail, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AlertsSubscribeForm() {
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // URL flash messages (după confirm/unsubscribe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const alert = params.get("alert");
    if (alert === "confirmed") setFlashMessage({ kind: "ok", text: "✓ Abonare confirmată! Vei primi email când e întrerupere pe adresa ta." });
    else if (alert === "unsubscribed") setFlashMessage({ kind: "ok", text: "Te-ai dezabonat cu succes. Nu mai primești alerte." });
    else if (alert === "invalid") setFlashMessage({ kind: "err", text: "Link invalid sau expirat. Re-abonează-te dacă vrei alerte." });
    if (alert) {
      const url = new URL(window.location.href);
      url.searchParams.delete("alert");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !address.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/intreruperi/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), address: address.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare");
      setDone(true);
      setEmail("");
      setAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div
        role="status"
        className="bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/30 rounded-[var(--radius-md)] p-5 text-left"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[var(--color-text)] mb-1">Email trimis!</p>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              Verifică inbox-ul tău și apasă „Confirmă abonarea”. Dacă nu vezi
              emailul în 5 minute, verifică folderul Spam.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {flashMessage && (
        <div
          role="status"
          className={`mb-4 rounded-[var(--radius-md)] p-3 text-sm flex items-start gap-2 ${
            flashMessage.kind === "ok"
              ? "bg-[var(--color-success-soft)] text-[var(--color-success-on-soft)]"
              : "bg-[var(--color-warning-soft)] text-[var(--color-warning-on-soft)]"
          }`}
        >
          {flashMessage.kind === "ok" ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{flashMessage.text}</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-3 text-left">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 inline-flex items-center gap-1.5">
            <Mail size={12} aria-hidden="true" />
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplu.ro"
            autoComplete="email"
            inputMode="email"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 inline-flex items-center gap-1.5">
            <MapPin size={12} aria-hidden="true" />
            Adresa pe care vrei să o urmărești
          </span>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ex: Strada Iancu Nicolae 23, Pipera, Voluntari"
            autoComplete="street-address"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
          <span className="text-xs text-[var(--color-text-muted)] mt-1 block">
            Cât mai specific (stradă + număr + cartier/oraș). Matchul se face pe strada + zonă.
          </span>
        </label>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={sending}
          disabled={sending || !email.trim() || !address.trim()}
          leftIcon={<span aria-hidden="true">🔔</span>}
          className="w-full"
        >
          {sending ? "Se trimite..." : "Anunță-mă"}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-red-500 mt-2 text-center">
            {error}
          </p>
        )}
      </form>
    </>
  );
}
