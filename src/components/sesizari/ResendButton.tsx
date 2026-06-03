"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

interface Props {
  code: string;
  /** Status livrare actual: null/sent → arătăm doar dacă e ghost send;
   *  bounced/complained → showtime cu mesaj clar. */
  deliveryStatus?: string | null;
  /** True dacă DB are sent_via_civia=true dar resend_message_id e null. */
  isGhostSend?: boolean;
}

/**
 * Buton „Retrimite la primării" — vizibil DOAR dacă sesizarea are
 * problemă de livrare:
 *   - Ghost send: sent_via_civia=true dar resend_message_id=null
 *   - Bounced: o adresă a respins
 *   - Complained: marked ca spam
 *
 * Plan 5/22/2026 (user request: „de ce nu raspund primariile, verifica
 * tot, imbunatateste tot"). UI face vizibil problema + permite acțiune.
 */
export function ResendButton({ code, deliveryStatus, isGhostSend }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!user) return null;

  // Show DOAR dacă există problemă reală.
  // 2026-06-03 — FIX contradicție (caz 00044): „Livrare neconfirmată" apărea
  // pe ghost-send (resend_message_id=null) CHIAR DACĂ delivery_status era
  // „delivered" → banner spunea „probabil n-a ajuns" lângă „deja livrat cu
  // succes". O livrare confirmată anulează euristica ghost-send: dacă serverul
  // a confirmat „delivered" (sau a venit reply de la primărie), emailul A ajuns,
  // indiferent că ID-ul Resend lipsește (trimiteri vechi / backfill).
  const confirmedDelivered = deliveryStatus === "delivered";
  const hasProblem =
    !confirmedDelivered &&
    (isGhostSend === true ||
      deliveryStatus === "bounced" ||
      deliveryStatus === "complained");
  if (!hasProblem) return null;

  const problemLabel = isGhostSend
    ? "Livrare neconfirmată"
    : deliveryStatus === "bounced"
    ? "Email respins de server"
    : deliveryStatus === "complained"
    ? "Marcat ca spam"
    : "Problemă livrare";

  async function resend() {
    setState("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/sesizari/${code}/resend-via-civia`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? "Retrimiterea a eșuat.");
        return;
      }
      setState("sent");
      // Reload data
      router.refresh();
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Eroare necunoscută");
    }
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-md)] p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-amber-100 mb-1">
            {problemLabel}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3">
            {isGhostSend
              ? "Emailul a fost marcat ca trimis, dar nu avem confirmare de livrare de la Resend. Probabil n-a ajuns la primării. Apasă retrimite ca să încercăm din nou."
              : deliveryStatus === "bounced"
              ? "Cel puțin o adresă de primărie a respins emailul. Retrimite ca să încercăm rute alternative."
              : "Emailul a fost marcat ca spam. Retrimite cu subject prefix [RETRIMITERE] ca filtrul să fie diferit."}
          </p>
          {state === "sent" ? (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-500">
              <CheckCircle2 size={16} aria-hidden="true" />
              Retrimis cu succes — verifică pagina în 30 secunde
            </div>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={state === "sending"}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-button)] bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {state === "sending" ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Retrimit...
                </>
              ) : (
                <>
                  <RefreshCw size={14} aria-hidden="true" />
                  Retrimite la primării
                </>
              )}
            </button>
          )}
          {state === "error" && errorMsg && (
            <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
