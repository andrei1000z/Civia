"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, Loader2, X, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/liquid-civic/sound";

interface Props {
  code: string;
  className?: string;
  /** Dacă true, deschide modalul de auth când userul anonim apasă pe buton
   *  în loc să ascundă butonul. Default true — flow primar din SuccessScreen
   *  trebuie să fie vizibil mereu (bug 2026-05-24: 94% drop-off pentru că
   *  butonul era invizibil pentru anonimi). */
  showForAnonymous?: boolean;
}

/**
 * Buton „Trimite cu Civia instant" pentru utilizatorii logati.
 *
 * Flow (5/22/2026 — user request „modal cu nume + adresa apoi trimite"):
 *   1. User apasă „Trimite" → POST /api/sesizari/[code]/send-via-civia
 *   2. Daca backend zice „needs_identity" (lipseste nume sau adresa pe
 *      sesizare) → arătăm modal cu inputs.
 *   3. User completează → POST din nou cu nume+adresa în body.
 *   4. Backend update sesizare + send email + return success.
 *   5. Redirect la /sesizari/[code].
 *
 * Email pleaca DE PE sesizari@civia.ro către autoritati. Reply-To
 * configurat in backend ca răspunsurile sa vină la sesizari@civia.ro
 * (worker → AI classify → user vede status update).
 */
export function SendViaCiviaButton({ code, className, showForAnonymous = true }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "needs-identity">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [identityNume, setIdentityNume] = useState("");
  const [identityAdresa, setIdentityAdresa] = useState("");
  const [missing, setMissing] = useState<{ nume: boolean; adresa: boolean }>({ nume: false, adresa: false });

  // Pre-fill identity din profile dacă userul are nume/adresă acolo.
  useEffect(() => {
    if (state !== "needs-identity") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          if (j.data.full_name && !identityNume) setIdentityNume(j.data.full_name);
          if (j.data.address && !identityAdresa) setIdentityAdresa(j.data.address);
        }
      })
      .catch(() => { /* silent */ });
  }, [state, identityNume, identityAdresa]);

  // Anonim: ascuns DOAR dacă showForAnonymous=false. Altfel arătăm un CTA
  // care invită la login (fix bug 2026-05-24: 94% drop-off pentru că butonul
  // era invizibil pentru anonimi → toate sesizările rămâneau cu sent_via_civia=false).
  if (!user) {
    if (!showForAnonymous) return null;
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => {
            // Salvăm intenția → după login redirecționăm direct înapoi
            // la pagina sesizării ca să apese din nou butonul.
            try {
              sessionStorage.setItem("civia:send_after_login", code);
            } catch { /* silent */ }
            // Trigger AuthModal via event (AuthProvider listening) sau redirect.
            window.dispatchEvent(new CustomEvent("civia:open-auth"));
          }}
          className="inline-flex w-full items-center justify-center gap-2 h-14 px-6 rounded-[var(--radius-md)] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-base font-bold hover:brightness-110 active:scale-[0.98] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
        >
          <LogIn size={18} aria-hidden="true" />
          Trimite oficial cu Civia (1-click)
        </button>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
          Confirmă-ți emailul în 10 secunde și Civia trimite sesizarea direct
          la primărie. <strong>Răspunsul lor vine în inbox-ul tău.</strong>
        </p>
      </div>
    );
  }

  const performSend = async (numePayload?: string, adresaPayload?: string) => {
    setState("sending");
    setErrorMsg("");
    playSound("send");
    try {
      const body: Record<string, string> = {};
      if (numePayload) body.nume = numePayload;
      if (adresaPayload) body.adresa = adresaPayload;

      const res = await fetch(`/api/sesizari/${code}/send-via-civia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        // 400 cu needs_identity → arătăm modal.
        if (res.status === 400 && json.needs_identity) {
          setMissing(json.missing ?? { nume: true, adresa: true });
          setState("needs-identity");
          setErrorMsg("");
          return;
        }
        // 409 = deja trimis — afisam state „sent" oricum.
        if (res.status === 409 && json.already) {
          setState("sent");
          setSentAt(json.sent_at);
          return;
        }
        setState("error");
        setErrorMsg(json.error ?? "Email-ul nu a putut fi trimis.");
        playSound("error");
        return;
      }
      setState("sent");
      setSentAt(json.sent_at);
      playSound("success");
      setTimeout(() => {
        router.push(`/sesizari/${code}`);
      }, 800);
    } catch {
      setState("error");
      setErrorMsg("Eroare de retea. Mai incearca.");
      playSound("error");
    }
  };

  const handleSend = async () => {
    if (state === "sending" || state === "sent") return;
    await performSend();
  };

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing.nume && identityNume.trim().length < 2) {
      setErrorMsg("Numele trebuie să aibă cel puțin 2 caractere.");
      return;
    }
    if (missing.adresa && identityAdresa.trim().length < 3) {
      setErrorMsg("Adresa trebuie să aibă cel puțin 3 caractere.");
      return;
    }
    await performSend(
      missing.nume ? identityNume.trim() : undefined,
      missing.adresa ? identityAdresa.trim() : undefined,
    );
  };

  if (state === "sent") {
    return (
      <div
        className={`inline-flex w-full items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-md)] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-semibold ${className ?? ""}`}
        role="status"
      >
        <CheckCircle2 size={18} aria-hidden="true" />
        Trimis automat
        {sentAt && (
          <span className="text-xs font-normal opacity-80">
            la {new Date(sentAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleSend}
        disabled={state === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 h-14 px-6 rounded-[var(--radius-md)] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-base font-bold hover:brightness-110 active:scale-[0.98] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] disabled:opacity-60 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
      >
        {state === "sending" ? (
          <>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            Se trimite...
          </>
        ) : (
          <>
            <Send size={20} aria-hidden="true" />
            Trimite acum cu Civia (1-click)
          </>
        )}
      </button>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
        Civia trimite emailul direct la primarie din partea ta. Raspunsul vine
        in inbox-ul tău și pe pagina sesizării. <strong>Apasă o dată, trimite o dată.</strong>
      </p>
      {state === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
          {errorMsg}
        </p>
      )}

      {/* Modal identity — apare cand backend zice needs_identity (5/22/2026). */}
      {state === "needs-identity" && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-start md:items-center justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Completează identitatea"
          onClick={(e) => {
            if (e.target === e.currentTarget) setState("idle");
          }}
        >
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] border border-[var(--color-border)] p-5 sm:p-6 my-8 max-h-[calc(100dvh-4rem)] overflow-y-auto animate-fade-in">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-1">
                  Mai un pas — identitatea ta
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Sesizările civice au nevoie de nume și adresă reală conform OG 27/2002.
                  Emailul pleacă imediat ce completezi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setState("idle")}
                aria-label="Închide"
                className="w-8 h-8 rounded-full hover:bg-[var(--color-surface-2)] inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleIdentitySubmit} className="space-y-3">
              {missing.nume && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Numele tău <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={identityNume}
                    onChange={(e) => setIdentityNume(e.target.value)}
                    placeholder="ex: Andrei Popescu"
                    required
                    autoFocus
                    minLength={2}
                    maxLength={120}
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  />
                </div>
              )}
              {missing.adresa && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Adresa de domiciliu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={identityAdresa}
                    onChange={(e) => setIdentityAdresa(e.target.value)}
                    placeholder="ex: Str. Florilor 12, Sector 3, București"
                    required
                    minLength={3}
                    maxLength={300}
                    autoFocus={!missing.nume}
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  />
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setState("idle")}
                  className="flex-1 h-11 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-[var(--radius-xs)] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:brightness-110 transition-all"
                >
                  <Send size={14} aria-hidden="true" />
                  Trimite
                </button>
              </div>

              <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed text-center">
                Datele sunt salvate pe profil pentru sesizări viitoare.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
