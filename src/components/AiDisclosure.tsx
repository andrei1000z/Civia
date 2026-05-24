/**
 * AI Act disclosure inline component — conform UE AI Act art. 50
 * (transparency obligation). User-ul trebuie să știe clar când conținutul
 * e AI-generated / AI-assisted.
 *
 * Conformitate:
 *   - Regulament (UE) 2024/1689 (AI Act) art. 50(1) — disclosure obligatoriu
 *   - GDPR art. 22 — decizii automate disclosure
 *   - DSA Reg. 2022/2065 — transparență moderare conținut
 *
 * 3 variante:
 *   - "sintetizat": AI summary (stiri, petitii) — disclosure inline
 *   - "clasificat": AI a clasificat (sesizare tip, severity) — disclosure cu opt-out
 *   - "generat": text complet AI-generated (formal_text) — disclosure prominent
 *
 * Folosire:
 *   <AiDisclosure variant="sintetizat" />
 *   <AiDisclosure variant="generat" model="Llama 3.3 70B" />
 */
import { Sparkles } from "lucide-react";

export interface AiDisclosureProps {
  variant: "sintetizat" | "clasificat" | "generat";
  /** Numele modelului AI folosit (opțional, default „Groq AI"). */
  model?: string;
  /** Compact mode pentru sidebar / mic widget. */
  compact?: boolean;
  className?: string;
}

const MESSAGES = {
  sintetizat: {
    short: "Sintetizat cu AI",
    long: "Acest text a fost generat automat de AI (sinteză din articol original). Verifică sursa pentru detalii complete.",
  },
  clasificat: {
    short: "Clasificat cu AI",
    long: "Tipul a fost detectat automat de AI (poză + descriere). Tu poți modifica manual înainte de submit — decizia finală e a ta.",
  },
  generat: {
    short: "Text generat cu AI",
    long: "Textul oficial al sesizării a fost generat automat dintr-un template determinist + datele tale. Conform UE AI Act art. 50, decizia finală îți aparține; poți edita oricând.",
  },
} as const;

export function AiDisclosure({ variant, model, compact = false, className }: AiDisclosureProps) {
  const msg = MESSAGES[variant];
  const modelLabel = model ?? "Groq AI";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-[var(--color-text-muted)] ${className ?? ""}`}
        title={msg.long}
      >
        <Sparkles size={10} className="text-violet-500" aria-hidden="true" />
        <span>{msg.short}</span>
      </span>
    );
  }

  return (
    <div
      role="note"
      aria-label="Disclosure AI conform UE AI Act"
      className={`inline-flex items-start gap-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] px-3 py-2 ${className ?? ""}`}
    >
      <Sparkles size={14} className="text-violet-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p>
          <strong className="text-[var(--color-text)]">{msg.short}</strong>
          {" — "}
          {msg.long}
        </p>
        <p className="text-[10px] mt-1 opacity-70">
          Model: {modelLabel} · Conform Reg. (UE) 2024/1689 art. 50
        </p>
      </div>
    </div>
  );
}
