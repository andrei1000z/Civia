"use client";

import { useState } from "react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/liquid-civic/sound";

interface Props {
  code: string;
  className?: string;
}

/**
 * Buton „Trimite cu Civia instant" pentru utilizatorii logati.
 *
 * Bug fixed: ~70% dropoff la mailto (Reddit feedback Tramagust). Inainte,
 * dupa „Trimite" se deschidea aplicatia de email a userului si nu stiam
 * daca a apasat send. Acum, daca user-ul e logat, putem trimite emailul
 * direct via Resend (server-side) cu Reply-To la user. Primaria raspunde
 * direct la user, dar tracking-ul e real (sent_via_civia=true).
 *
 * Doar pentru autorul sesizarii. User-ii ne-logati vad fallback mailto.
 */
export function SendViaCiviaButton({ code, className }: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sentAt, setSentAt] = useState<string | null>(null);

  if (!user) return null; // doar logged-in users

  const handleSend = async () => {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    setErrorMsg("");
    playSound("send");
    try {
      const res = await fetch(`/api/sesizari/${code}/send-via-civia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
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
    } catch {
      setState("error");
      setErrorMsg("Eroare de retea. Mai incearca.");
      playSound("error");
    }
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
        in inbox-ul tau. <strong>Mai usor decat sa deschizi aplicatia de email.</strong>
      </p>
      {state === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
