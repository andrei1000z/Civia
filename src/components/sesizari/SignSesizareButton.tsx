"use client";

import { useState, useEffect } from "react";
import { UserPlus, X, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { getRecipientsLabel } from "@/lib/sesizari/mailto";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

interface Props {
  tip: string;
  titlu: string;
  locatie: string;
  sector?: string | null;
  descriere: string;
  formal_text?: string | null;
  imagini?: string[];
  code: string;
  variant?: "primary" | "outline";
}

const STORAGE_KEY = "civic_user_data";

interface UserData {
  name: string;
  address: string;
  email: string;
}

/**
 * „Trimite și tu" — Co-sign + send REAL prin sesizari@civia.ro (Resend).
 *
 * 5/22/2026 — Refactor complet la cererea user-ului. Înainte:
 *   • Modal cu form
 *   • EmailChoicePanel cu Gmail/Outlook/Mailto/Copy
 *   • Pe mobil: link-uri descărcare poze manual + mailto:
 *   • User trebuia să atașeze pozele manual în Gmail/Mail/etc
 *
 * Acum:
 *   1. User apasă „Trimite și tu" → modal cu nume + adresa
 *   2. Apasă „Trimite" → POST /api/sesizari/[code]/cosign-send
 *   3. Backend trimite REAL via Resend de la sesizari@civia.ro
 *      cu identitatea persoanei care trimite + atașează pozele AUTOMAT
 *   4. Success → arată confirmation + closes modal
 *
 * Zero mailto, zero descărcat poze, zero browser email apps.
 */
export function SignSesizareButton({
  tip,
  titlu,
  sector,
  code,
  variant = "primary",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"form" | "sending" | "sent" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  // Lazy initializer — reads localStorage sync on first render
  const [data, setData] = useState<UserData>(() => {
    if (typeof window === "undefined") return { name: "", address: "", email: "" };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as UserData;
      } catch {
        /* ignore corrupt */
      }
    }
    return { name: "", address: "", email: "" };
  });
  const [remember, setRemember] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Honeypot — bots completează automat, respinge silent
  const [honey, setHoney] = useState("");

  // Escape closes + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
     
  }, [open]);

  // Auto-fill din profile dacă user logat
  useEffect(() => {
    if (!user || profileLoaded) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setData((prev) => ({
            name: j.data.full_name || j.data.display_name || prev.name,
            address: j.data.address || prev.address,
            email: j.data.email || prev.email,
          }));
        }
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, [user, profileLoaded]);

  const canSubmit = data.name.trim().length >= 2 && data.address.trim().length >= 3;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (remember && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    setState("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/sesizari/${code}/cosign-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nume: data.name.trim(),
          adresa: data.address.trim(),
          email: data.email.trim() || null,
          _honey: honey,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setErrorMsg(json.error ?? "Email-ul nu a putut fi trimis.");
        return;
      }
      setState("sent");
      // Notifica CosignersBadge să refresh
      window.dispatchEvent(new CustomEvent("civia:cosign-added"));
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Eroare rețea");
    }
  }

  function handleClose() {
    setOpen(false);
    // Reset state după 300ms (timpul animației de fade-out)
    setTimeout(() => {
      setState("form");
      setErrorMsg("");
    }, 300);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-xs)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
          variant === "primary"
            ? "h-11 px-5 text-sm bg-[var(--color-secondary)] text-white hover:brightness-110 shadow-md"
            : "h-9 px-3 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]",
        )}
        title="Trimite același email la autorități cu identitatea ta — direct prin Civia."
      >
        <UserPlus size={variant === "primary" ? 16 : 13} aria-hidden="true" />
        Trimite și tu
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={handleClose}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-modal-title"
            className="w-full max-w-lg bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] my-8 overflow-hidden animate-modal-pop"
          >
            <header className="bg-gradient-to-r from-[var(--color-secondary)] to-emerald-700 text-white p-5 relative">
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Închide"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <h3
                id="sign-modal-title"
                className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1"
              >
                {state === "sent" ? "Email trimis ✓" : "Trimite și tu această sesizare"}
              </h3>
              <p className="text-sm text-white/85">
                {state === "sent"
                  ? "Identitatea ta a fost adăugată la sesizare și emailul a plecat la autorități."
                  : "Completează datele tale. Emailul pleacă DIRECT de la sesizari@civia.ro cu pozele atașate automat."}
              </p>
            </header>

            {state === "sent" ? (
              <div className="p-6 space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 grid place-items-center mx-auto">
                  <CheckCircle2 size={32} aria-hidden="true" />
                </div>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  Cu cât suntem mai mulți, cu atât autoritățile răspund mai repede.
                  Mulțumim pentru implicare! 🙌
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                >
                  Închide
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4" autoComplete="on">
                {/* Honeypot — invisible to humans, attractive to bots. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honey}
                  onChange={(e) => setHoney(e.target.value)}
                  aria-hidden="true"
                  className="absolute opacity-0 pointer-events-none -z-10"
                  style={{ position: "absolute", left: "-9999px" }}
                />
                <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-muted)]">
                  <p className="font-semibold text-[var(--color-text)] mb-1">Despre sesizare:</p>
                  <p className="line-clamp-2">{titlu}</p>
                  <p className="mt-2">
                    <strong>Se trimite la:</strong> {getRecipientsLabel(tip, sector)}
                  </p>
                </div>

                <div>
                  <label htmlFor="cosign-name" className="block text-sm font-medium mb-1.5">
                    Numele tău <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cosign-name"
                    type="text"
                    autoComplete="name"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="Ex: Ion Popescu"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    required
                    disabled={state === "sending"}
                  />
                </div>

                <div>
                  <label htmlFor="cosign-address" className="block text-sm font-medium mb-1.5">
                    Adresa ta (domiciliu) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cosign-address"
                    type="text"
                    autoComplete="street-address"
                    value={data.address}
                    onChange={(e) => setData({ ...data, address: e.target.value })}
                    placeholder="Ex: Str. Exemplu 12, Sector 3, București"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    required
                    disabled={state === "sending"}
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                    Necesar pentru identificare oficială în emailul către primărie (OG 27/2002 art. 12). Pe pagina publică numele și adresa NU apar.
                  </p>
                </div>

                <div>
                  <label htmlFor="cosign-email" className="block text-sm font-medium mb-1.5">
                    Email <span className="text-[var(--color-text-muted)] font-normal">(opțional, primești copie)</span>
                  </label>
                  <input
                    id="cosign-email"
                    type="email"
                    autoComplete="email"
                    value={data.email}
                    onChange={(e) => setData({ ...data, email: e.target.value })}
                    placeholder="exemplu@email.ro"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    disabled={state === "sending"}
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Ține minte datele în browser (data viitoare nu mai le tastezi)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!canSubmit || state === "sending"}
                  className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
                >
                  {state === "sending" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Trimit emailul către autorități...
                    </>
                  ) : (
                    <>
                      Trimite acum
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  )}
                </button>

                {state === "error" && errorMsg && (
                  <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                    {errorMsg}
                  </p>
                )}

                <p className="text-[11px] text-center text-[var(--color-text-muted)] leading-relaxed">
                  📎 Pozele se atașează automat · 🇪🇺 Date stocate în UE · Conform OG 27/2002
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
