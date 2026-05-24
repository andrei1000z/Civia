"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X, ShieldCheck, ChartNoAxesColumn, Settings2 } from "lucide-react";

const STORAGE_KEY = "civic_cookie_consent";
const CHANGE_EVENT = "civic:cookie-consent:reopen";

type ConsentValue = "accepted-all" | "essential-only" | "custom" | "rejected";

interface ConsentRecord {
  version: 2;
  value: ConsentValue;
  essential: true;
  preferences: boolean;
  analytics: boolean;
  decidedAt: string;
}

function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    if (raw === "accepted" || raw === "dismissed") {
      // Old (v1) consent — re-prompt for granular choice.
      return null;
    }
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(value: ConsentValue, opts: { preferences: boolean; analytics: boolean }) {
  if (typeof window === "undefined") return;
  const record: ConsentRecord = {
    version: 2,
    value,
    essential: true,
    preferences: opts.preferences,
    analytics: opts.analytics,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  // Sync cross-device daca userul e logat.
  import("@/lib/preferences/sync").then(({ writeRemotePreferences }) => {
    writeRemotePreferences({
      cookie_consent: {
        essential: true,
        preferences: opts.preferences,
        analytics: opts.analytics,
        marketing: false,
        acceptedAt: record.decidedAt,
      },
    });
  }).catch(() => { /* offline / not logged in — ok */ });
  window.dispatchEvent(new CustomEvent("civic:cookie-consent:changed", { detail: record }));
}

/**
 * Open the cookie banner programmatically — used by the footer "Preferințe
 * cookie" link for GDPR consent retraction (art. 7(3) GDPR).
 */
export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [allowPreferences, setAllowPreferences] = useState(true);
  const [allowAnalytics, setAllowAnalytics] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const consent = readConsent();
    // Delay 1.5s before first-show. Analytics: prompt-on-load era eating
    // 28% of bottom-right clicks. 3.5s era prea agresiv (utilizatorul
    // scrollea, eveneementul „pop" intrerupea). 1.5s e under-the-radar:
    // pagina se asaza, user vede banner-ul cand termina prima privire.
    const showTimer = !consent
      ? window.setTimeout(() => setVisible(true), 1500)
      : null;

    const reopen = () => {
      const current = readConsent();
      if (current) {
        setAllowPreferences(current.preferences);
        setAllowAnalytics(current.analytics);
      }
      setShowCustom(true);
      setVisible(true);
    };
    window.addEventListener(CHANGE_EVENT, reopen);

    // Cand prefs-le se hydrate din DB (login), ascundem banner-ul daca remote
    // are deja consent. Asta inseamna: ai acceptat pe laptop, deschizi pe
    // telefon logat → nu mai apare prompt.
    const onHydrate = (e: Event) => {
      const detail = (e as CustomEvent<{ cookie_consent: ConsentRecord["essential"] extends boolean ? { acceptedAt: string; preferences: boolean; analytics: boolean } | null : never }>).detail;
      if (detail?.cookie_consent) {
        // Mirror remote in localStorage daca lipseste local.
        const localConsent = readConsent();
        if (!localConsent) {
          const remote = detail.cookie_consent;
          const record: ConsentRecord = {
            version: 2,
            value: remote.analytics && remote.preferences ? "accepted-all" : "custom",
            essential: true,
            preferences: remote.preferences,
            analytics: remote.analytics,
            decidedAt: remote.acceptedAt,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
          window.dispatchEvent(new CustomEvent("civic:cookie-consent:changed", { detail: record }));
        }
        setVisible(false);
        if (showTimer) window.clearTimeout(showTimer);
      }
    };
    window.addEventListener("civia:prefs-hydrated", onHydrate);

    return () => {
      window.removeEventListener(CHANGE_EVENT, reopen);
      window.removeEventListener("civia:prefs-hydrated", onHydrate);
      if (showTimer) window.clearTimeout(showTimer);
    };
  }, []);

  const acceptAll = () => {
    saveConsent("accepted-all", { preferences: true, analytics: true });
    setVisible(false);
  };

  const rejectAll = () => {
    saveConsent("essential-only", { preferences: false, analytics: false });
    setVisible(false);
  };

  const saveCustom = () => {
    saveConsent("custom", { preferences: allowPreferences, analytics: allowAnalytics });
    setVisible(false);
    setShowCustom(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      aria-modal="false"
      className="glass-surface-strong fixed left-2 right-2 md:left-auto md:right-6 md:max-w-md z-40 rounded-[var(--radius-md)] md:rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-3 md:p-5 animate-fade-in-up"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
    >
      <div className="flex items-start gap-2 md:gap-3">
        <Cookie size={18} className="text-[var(--color-primary)] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm min-w-0">
          {/* Pe mobile: compact one-liner. Pe desktop: title + paragraf descriere.
              Bug raportat 5/21/2026: banner-ul de 400px ocupa 70% din viewport-ul
              mobil si bloca harta + cardurile. Acum stripa subtire. */}
          <p id="cookie-banner-title" className="font-semibold mb-0.5 md:mb-1 text-xs md:text-sm">
            <span className="md:hidden">Cookies?</span>
            <span className="hidden md:inline">Cookies și viața ta privată</span>
          </p>
          <p id="cookie-banner-desc" className="hidden md:block text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
            Folosim doar cookies <strong>strict necesare</strong> (autentificare,
            consimțământ). Nu folosim Google Analytics, nu te trackăm pe alte
            site-uri, nu vindem date. Conform GDPR și Directivei ePrivacy, ai
            libertatea totală să accepți sau să respingi orice cookie non-esențial.
          </p>
          {/* Mobile one-liner (~30 chars). Detalii via „Personalizează" */}
          <p className="md:hidden text-[11px] text-[var(--color-text-muted)] mb-2 leading-tight">
            Strict necesare. Fără tracking.
          </p>

          {!showCustom && (
            <>
              {/* 2026-05-24 (P1.153) WCAG 2.2 + EU Austria 2025: touch
                  target min 44px mobile; Accept/Respinge parity vizuală
                  (Austria high court — colored Accept + gray Reject =
                  GDPR parity violation). Acum ambele au aceeași prominență
                  vizuală. */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="h-11 md:h-9 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] transition-colors"
                >
                  Accept tot
                </button>
                <button
                  type="button"
                  onClick={rejectAll}
                  className="h-11 md:h-9 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-medium hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
                >
                  Respinge tot
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="h-11 md:h-9 px-3 rounded-[var(--radius-xs)] text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] inline-flex items-center gap-1 transition-colors"
                >
                  <Settings2 size={14} aria-hidden="true" />
                  <span>Personalizează</span>
                </button>
              </div>
              <p className="hidden md:block text-[10px] text-[var(--color-text-muted)] mt-2">
                Detalii complete în{" "}
                <Link
                  href="/legal/confidentialitate#cookies"
                  className="text-[var(--color-primary)] underline"
                >
                  politica de confidențialitate
                </Link>
                .
              </p>
            </>
          )}

          {showCustom && (
            <div className="space-y-2.5 mt-1">
              {/* Essential — always on, locked */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] cursor-not-allowed">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="mt-0.5 accent-[var(--color-primary)]"
                  aria-readonly="true"
                />
                <div className="flex-1">
                  <p className="font-medium text-xs flex items-center gap-1.5">
                    <ShieldCheck size={11} aria-hidden="true" /> Strict necesare
                    <span className="text-[10px] font-normal text-[var(--color-text-muted)]">(întotdeauna active)</span>
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                    Sesiunea autentificare Supabase, consimțământ. Fără ele platforma nu funcționează.
                  </p>
                </div>
              </label>

              {/* Preferences */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPreferences}
                  onChange={(e) => setAllowPreferences(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-primary)]"
                />
                <div className="flex-1">
                  <p className="font-medium text-xs flex items-center gap-1.5">
                    <Settings2 size={11} aria-hidden="true" /> Preferințe
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                    Sunete UI, preferințe de notificări, mesaje închise (cookie
                    banner, install prompt) — îți personalizează experiența pe
                    Civia.
                  </p>
                </div>
              </label>

              {/* Analytics */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAnalytics}
                  onChange={(e) => setAllowAnalytics(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-primary)]"
                />
                <div className="flex-1">
                  <p className="font-medium text-xs flex items-center gap-1.5">
                    <ChartNoAxesColumn size={11} aria-hidden="true" /> Statistici anonime
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                    Vizitator-ID anonim (hash), pagini vizitate, eroare. Nu identificăm persoane, nu folosim Google Analytics.
                  </p>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveCustom}
                  className="flex-1 h-9 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] transition-colors"
                >
                  Salvează preferințele
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="h-9 px-3 rounded-[var(--radius-xs)] text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Înapoi
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            // Treat plain dismiss as essential-only (more privacy-friendly default).
            saveConsent("essential-only", { preferences: false, analytics: false });
            setVisible(false);
          }}
          className="w-9 h-9 -mt-1 -mr-1 rounded-full hover:bg-[var(--color-surface-2)] flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
          aria-label="Închide banner — păstrează doar cookies esențiale"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
