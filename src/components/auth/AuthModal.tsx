"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "./AuthProvider";

// Toggle via NEXT_PUBLIC_ENABLE_GOOGLE_AUTH / NEXT_PUBLIC_ENABLE_APPLE_AUTH env vars
// (set to "1" in Vercel after configuring the provider in Supabase Dashboard).
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "1";
const APPLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "1";
const ANY_OAUTH = GOOGLE_ENABLED || APPLE_ENABLED;

// Email format check (loose — server has the authoritative rules; client
// just catches typos before a Supabase round-trip).
const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, signInWithEmail, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Default OFF (5/8/2026): user prefera real opt-in -- doar cei care
  // vor genuin sa fie reamintiti de platforma bifeaza. Newsletter
  // scos din footer in aceasi sesiune; signup e singurul loc.
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);

  // Inline validation: only show error AFTER user has blurred the field
  // and only when the value isn't empty (don't shame empty fields prematurely).
  const inlineError = emailTouched && email.trim() && !EMAIL_RE.test(email.trim())
    ? `Format invalid — încearcă „nume@exemplu.ro"`
    : null;

  // When the user clicks Back after a failed OAuth redirect, the browser
  // restores this component from bfcache with oauthLoading still set.
  // Clear it so the button is clickable again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setOauthLoading(null);
        setStatus("idle");
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    // Client-side guard so a typo doesn't trigger a Supabase round-trip
    // with an opaque "rate limit" or "invalid email format" error.
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMsg("Adresă de email incorectă. Verifică formatul (ex: nume@exemplu.ro).");
      return;
    }
    setStatus("sending");
    setErrorMsg(null);
    const { error } = await signInWithEmail(trimmed);
    if (error) {
      setStatus("error");
      setErrorMsg(error);
    } else {
      setStatus("sent");
      // Best-effort: subscribe to newsletter if the user opted in.
      // Failure here doesn't block the magic-link flow — they're
      // already getting the auth email, which is the priority.
      if (subscribeNewsletter) {
        fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        }).catch(() => { /* silent */ });
      }
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    setErrorMsg(null);
    const { error } = await signInWithOAuth(provider);
    if (error) {
      setErrorMsg(error);
      setOauthLoading(null);
    }
    // On success, user is redirected by Supabase → no need to close modal
  };

  const handleClose = () => {
    closeAuthModal();
    setTimeout(() => {
      setEmail("");
      setStatus("idle");
      setErrorMsg(null);
      setOauthLoading(null);
    }, 300);
  };

  return (
    <Modal open={isAuthModalOpen} onClose={handleClose} title="Intră în contul tău Civia">
      {status === "sent" ? (
        <div role="status" className="text-center py-4">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Verifică-ți emailul</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Ți-am trimis linkul de autentificare la <strong>{email}</strong>.
            Dă click pe el din inbox și te conectezi instant — fără parolă de reținut.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Nu vezi emailul? Verifică folderul Spam/Promotions.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Am înțeles
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {ANY_OAUTH
              ? "Google sau email — alege cum preferi. Fără parole de ținut minte. Contul îți permite să votezi, să comentezi, să urmărești sesizări."
              : "Îți trimitem un link unic pe email. Click și ești conectat — fără parolă. Contul e necesar ca să votezi, comentezi sau urmărești sesizări."}
          </p>

          {ANY_OAUTH && (
            <>
              <div className="space-y-2 mb-4">
                {GOOGLE_ENABLED && (
                  <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    disabled={oauthLoading !== null || status === "sending"}
                    aria-busy={oauthLoading === "google"}
                    className="w-full h-11 rounded-[var(--radius-xs)] bg-white dark:bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] dark:hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50 flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    {oauthLoading === "google" ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                      </svg>
                    )}
                    <span>Conectare cu Google</span>
                  </button>
                )}
                {APPLE_ENABLED && (
                  <button
                    type="button"
                    onClick={() => handleOAuth("apple")}
                    disabled={oauthLoading !== null || status === "sending"}
                    aria-busy={oauthLoading === "apple"}
                    className="w-full h-11 rounded-[var(--radius-xs)] bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    {oauthLoading === "apple" ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
                        <path d="M11.624 9.296c-.02-2.07 1.69-3.06 1.767-3.108-.963-1.41-2.461-1.6-2.994-1.623-1.274-.128-2.487.75-3.135.75-.647 0-1.647-.731-2.71-.712-1.395.02-2.685.811-3.402 2.057-1.45 2.514-.37 6.238 1.045 8.28.692 1 1.516 2.125 2.596 2.086 1.043-.042 1.436-.676 2.696-.676 1.26 0 1.615.676 2.718.654 1.123-.02 1.834-1.017 2.52-2.022.793-1.16 1.12-2.285 1.138-2.343-.024-.01-2.186-.838-2.21-3.32zM9.555 3.195c.574-.696.96-1.663.854-2.625-.827.034-1.825.55-2.418 1.246-.532.615-.998 1.598-.871 2.544.92.072 1.86-.468 2.435-1.165z" />
                      </svg>
                    )}
                    <span>Conectare cu Apple</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">sau</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5">
              Adresa ta de email
            </label>
            <div className="relative mb-4">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                aria-invalid={inlineError != null || (status === "error" && errorMsg != null)}
                aria-describedby={inlineError ? "auth-email-error" : undefined}
                placeholder="nume@exemplu.ro"
                className={`w-full h-11 pl-9 pr-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 transition-colors ${
                  inlineError
                    ? "border-red-500 dark:border-red-400"
                    : "border-[var(--color-border)]"
                }`}
                disabled={status === "sending" || oauthLoading !== null}
              />
            </div>
            {inlineError && !errorMsg && (
              <p id="auth-email-error" role="status" className="text-xs text-red-600 dark:text-red-400 mb-3 -mt-2">
                {inlineError}
              </p>
            )}
            {errorMsg && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">{errorMsg}</p>
            )}
            <label className="flex items-start gap-2.5 mb-3 text-xs text-[var(--color-text-muted)] cursor-pointer leading-relaxed">
              <input
                type="checkbox"
                checked={subscribeNewsletter}
                onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                className="mt-0.5 accent-[var(--color-primary)] cursor-pointer shrink-0"
              />
              <span>
                Trimite-mi <strong>un email săptămânal</strong> ca reamintire — sesizări
                noi din zona mea, ca să nu uit de platformă când văd ceva pe stradă.
                Dezabonare cu un click.
              </span>
            </label>
            <button
              type="submit"
              disabled={status === "sending" || !email || oauthLoading !== null}
              className="w-full h-11 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              {status === "sending" ? "Se trimite linkul..." : "Trimite-mi linkul de conectare"}
            </button>
          </form>

          <p className="text-xs text-[var(--color-text-muted)] mt-4 text-center">
            Conectarea înseamnă că ești de acord cu <Link href="/legal/termeni" className="text-[var(--color-primary)] hover:underline">termenii</Link> și cu <Link href="/legal/confidentialitate" className="text-[var(--color-primary)] hover:underline">politica de confidențialitate</Link>. Datele tale nu sunt vândute nimănui.
          </p>
        </div>
      )}
    </Modal>
  );
}
