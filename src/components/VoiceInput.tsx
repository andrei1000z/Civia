"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface Props {
  /** Callback când transcrierea e gata */
  onTranscript: (text: string) => void;
  /** Limba pentru Web Speech API */
  lang?: string;
  /** Aria label */
  ariaLabel?: string;
}

/**
 * 🎁 MEDIUM #9 — Voice input pentru sesizari.
 *
 * Foloseste Web Speech API cand e disponibil (Chrome desktop + Android).
 * iOS Safari NU expune SpeechRecognition — afișăm fallback help text.
 *
 * Real-time partial transcript displayed in textarea. La oprire, callback
 * cu textul final apelat.
 *
 * Acord GDPR: SpeechRecognition runs client-side (no server upload).
 * Browser-ul foloseste vendor cloud (Google pentru Chrome) — disclosure clar.
 */
export function VoiceInput({ onTranscript, lang = "ro-RO", ariaLabel = "Dictează" }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<{ start: () => void; stop: () => void; abort: () => void } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const toggle = () => {
    if (!supported) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    setError(null);
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (!r) continue;
        const first = r[0];
        if (r.isFinal && first) finalText += first.transcript + " ";
      }
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(e.error || "Eroare microfon");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const trimmed = finalText.trim();
      if (trimmed) onTranscript(trimmed);
    };

    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  if (!supported) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-not-allowed"
        title="Voice input nu este disponibil în acest browser (folosește Chrome desktop sau Android)"
        disabled
      >
        <MicOff size={14} aria-hidden="true" />
        Dictare indisponibilă
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Oprește dictarea" : ariaLabel}
      aria-pressed={listening}
      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-[var(--radius-xs)] text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
        listening
          ? "bg-red-500 text-white"
          : "bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
      }`}
    >
      {listening ? (
        <>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Înregistrez... apasă să oprești
        </>
      ) : (
        <>
          <Mic size={14} aria-hidden="true" />
          Dictează
        </>
      )}
      {error && <span className="sr-only">Eroare: {error}</span>}
    </button>
  );
}

// Local type declarations pentru a evita conflict cu definitia globala
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; [j: number]: { transcript: string } };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}
