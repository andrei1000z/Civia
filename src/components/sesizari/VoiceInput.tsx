"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, RotateCcw } from "lucide-react";

// Subset of the Web Speech API types we need. Not in lib.dom yet on
// every browser's TS bundle, so we declare just the surface we use.
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechWindow extends Window {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
}

/**
 * Microphone button that dictates Romanian speech into a target
 * callback. Uses the Web Speech API when available (Chrome, Edge,
 * Safari iOS 14+); hides itself on unsupported browsers.
 *
 * Smart post-processing pe transcripturile finale (cerere user 2026-05-15):
 *  • Filler-word strip: „ăăă", „deci", „păi", „cumva" — apar des în
 *    vorbirea spontana, dar e zgomot in textul scris.
 *  • Stutter dedup: două cuvinte identice consecutive („pe pe trotuar")
 *    → unul singur. Frecvent in dictare.
 *  • Pauza-bazata punctuatie: două utterance-uri finale la distanță ≥800ms
 *    → punct + spațiu între ele, capitalize prima litera de la al doilea.
 *  • Interim results vizibile: userul vede textul cum vorbește, ștergere
 *    automată cand utterance-ul e finalizat.
 */
export function VoiceInput({
  onTranscript,
  className,
}: {
  onTranscript: (delta: string) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"permission" | "policy" | "network" | "silence" | "other" | null>(null);
  const [interim, setInterim] = useState<string>("");
  const recRef = useRef<Recognition | null>(null);
  const lastFinalAtRef = useRef<number>(0);
  // Anti-duplicate set — Chrome continuous mode re-emite uneori același
  // index final, fără asta transcript-ul se umple de „să să să" repetat.
  const processedFinalsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    // setState în effect — feature detection rulează doar pe client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!Ctor);
  }, []);

  // Stop any in-progress recording when the component unmounts —
  // avoids ghost mic access if user navigates away mid-dictation.
  useEffect(() => {
    return () => {
      try { recRef.current?.stop(); } catch { /* already stopped */ }
    };
  }, []);

  if (!supported) return null;

  /** Curăță transcript-ul: filler words + stutter + trim. */
  const cleanTranscript = (raw: string): string => {
    let text = raw.trim();
    if (!text) return "";
    // 1. Filler words — case-insensitive, păstrăm spațiul de după.
    text = text.replace(/\b(ăăă+|aaaa+|uhm+|um+|eee+|îhî+|deci|păi|înțelegi|cumva|cam așa)\b\s*/gi, "");
    // 2. Stutter dedup — „pe pe trotuar" → „pe trotuar". Iterativ ca să
    //    prindă tripluri („e e e mașină" → „e mașină").
    let prev = "";
    while (prev !== text) {
      prev = text;
      text = text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
    }
    // 3. Whitespace dublu
    text = text.replace(/\s+/g, " ").trim();
    return text;
  };

  const toggle = async () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setError(null);
    setErrorKind(null);
    setInterim("");
    processedFinalsRef.current = new Set();

    // Pre-flight: triggher prompt-ul native via getUserMedia. Web Speech
    // singur nu garanteaza prompt-ul pe Chrome desktop — getUserMedia da.
    if ("mediaDevices" in navigator && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        const name = (err as Error)?.name ?? "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setErrorKind("permission");
          setError("Permite microfonul din 🔒 lângă URL.");
        } else if (name === "NotFoundError") {
          setErrorKind("other");
          setError("Niciun microfon găsit.");
        } else {
          setErrorKind("policy");
          setError("Microfonul nu poate fi pornit.");
        }
        return;
      }
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "ro-RO";
    rec.onresult = (e: SpeechEventLike) => {
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const rawText = r[0]?.transcript ?? "";
        if (r.isFinal) {
          if (processedFinalsRef.current.has(i)) continue;
          processedFinalsRef.current.add(i);
          const cleaned = cleanTranscript(rawText);
          if (!cleaned) continue;
          // Pauză între utterance-uri ≥ 800ms → inserează „. " plus
          // capitalize prima literă a noului chunk. Asta dă punctuație
          // automată în loc de stream continuu fără punct.
          const now = Date.now();
          const sincePrev = lastFinalAtRef.current === 0 ? 0 : now - lastFinalAtRef.current;
          lastFinalAtRef.current = now;
          let toAppend = cleaned;
          if (sincePrev >= 800) {
            // Început de propoziție nouă — capitalize.
            toAppend = toAppend.charAt(0).toUpperCase() + toAppend.slice(1);
            onTranscript(". " + toAppend);
          } else {
            onTranscript(" " + toAppend);
          }
          setInterim("");
        } else {
          interimChunk += rawText;
        }
      }
      // Interim afișat doar în UI, nu trimis la parent.
      if (interimChunk) setInterim(interimChunk.slice(0, 120));
    };
    rec.onerror = (e: unknown) => {
      setListening(false);
      setInterim("");
      const code = (e as { error?: string })?.error ?? "";
      if (code === "not-allowed") {
        setErrorKind("permission");
        setError("Ai refuzat microfonul. Activează-l din 🔒 lângă URL și încearcă din nou.");
      } else if (code === "service-not-allowed") {
        setErrorKind("policy");
        setError("Microfonul e blocat de browser/site. Reîncarcă pagina.");
      } else if (code === "no-speech") {
        setErrorKind("silence");
        setError("Nu te-am auzit. Vorbește mai aproape.");
      } else if (code === "network") {
        setErrorKind("network");
        setError("Fără conexiune — dictarea cere internet.");
      } else if (code === "aborted") {
        // user closed mic via toggle — nu e eroare
      } else {
        setErrorKind("other");
        setError("Dictarea n-a mers. Încearcă din nou.");
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    try {
      rec.start();
      recRef.current = rec;
      lastFinalAtRef.current = 0;
      setListening(true);
    } catch {
      // .start() throws InvalidStateError dacă serviciul deja ruleaza
      // (double-click) — ignor, onend fires curând.
    }
  };

  const retry = () => {
    setError(null);
    setErrorKind(null);
    // Mic delay ca user-ul să vadă că ceva s-a întâmplat
    setTimeout(toggle, 50);
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? "Oprește dictarea" : "Dictează în română"}
        aria-pressed={listening}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-xs)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
          listening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
        } ${className ?? ""}`}
        title={listening ? "Înregistrează... apasă pentru stop" : "Dictează în română (clic pentru start)"}
      >
        {listening ? <MicOff size={14} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
      </button>
      {interim && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic max-w-[200px] text-right" aria-live="polite">
          „{interim}…"
        </p>
      )}
      {error && (
        <div className="flex flex-col items-end gap-1">
          <p className="text-[10px] text-red-500 max-w-[200px] text-right leading-tight" role="alert">
            {error}
          </p>
          {(errorKind === "silence" || errorKind === "network" || errorKind === "other") && (
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
            >
              <RotateCcw size={10} aria-hidden="true" />
              Încearcă din nou
            </button>
          )}
        </div>
      )}
    </div>
  );
}
