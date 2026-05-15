"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Loader2, Send, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SESIZARE_TIPURI } from "@/lib/constants";
import { detectSectorFromCoords } from "@/lib/geo/sector-from-coords";

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

type Phase = "idle" | "listening" | "processing" | "review" | "sent" | "error";

/**
 * Voice-only sesizare flow — variantă mobile-first cu hold-to-record.
 *
 * Flow:
 *  1. PHASE idle: buton mare „Apasă și vorbește" (pointerdown start, pointerup stop)
 *  2. PHASE listening: spinner + transcript live + count-down 60s max
 *  3. PHASE processing: în paralel — AI classify (tip) + getLocation (GPS+reverse)
 *  4. PHASE review: pagină simplă „Am înțeles asta:" cu tip + locație editabilă + buton Trimite
 *  5. PHASE sent: confirmare + link spre sesizarea ta
 *
 * Pe useri ne-logați redirect transparent la /sesizari (form complet).
 */
export function VoiceSesizareFlow() {
  const { user, openAuthModal } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [tip, setTip] = useState<string>("");
  const [locatie, setLocatie] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const lastFinalAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!Ctor);
  }, []);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      try { recRef.current?.stop(); } catch { /* noop */ }
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  if (!supported) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <MicOff size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" aria-hidden="true" />
        <h2 className="font-semibold text-base mb-2">Microfonul nu e suportat în browser</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Folosește Chrome, Edge, Safari sau Firefox pe mobile. Pe iPhone trebuie să fii pe Safari, nu Chrome.
        </p>
        <Link
          href="/sesizari"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Folosește formularul scris
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const cleanTranscript = (raw: string): string => {
    let text = raw.trim();
    if (!text) return "";
    text = text.replace(/\b(ăăă+|aaaa+|uhm+|um+|eee+|îhî+|deci|păi|înțelegi|cumva|cam așa)\b\s*/gi, "");
    let prev = "";
    while (prev !== text) {
      prev = text;
      text = text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
    }
    text = text.replace(/\s+/g, " ").trim();
    return text;
  };

  const startListening = () => {
    setError(null);
    setTranscript("");
    setInterim("");
    setPhase("listening");
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "ro-RO";
    rec.onresult = (e) => {
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const raw = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const cleaned = cleanTranscript(raw);
          if (!cleaned) continue;
          const now = Date.now();
          const sincePrev = lastFinalAtRef.current === 0 ? 0 : now - lastFinalAtRef.current;
          lastFinalAtRef.current = now;
          const prefix = lastFinalAtRef.current && transcript ? (sincePrev >= 800 ? ". " : " ") : "";
          const capitalized = sincePrev >= 800
            ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
            : cleaned;
          setTranscript((t) => (t + prefix + capitalized).trim());
          setInterim("");
        } else {
          interimChunk += raw;
        }
      }
      if (interimChunk) setInterim(interimChunk.slice(0, 160));
    };
    rec.onerror = (ev) => {
      const code = (ev as { error?: string }).error ?? "";
      if (code === "not-allowed") {
        setError("Ai refuzat microfonul. Activează-l din 🔒 lângă URL.");
      } else if (code === "service-not-allowed") {
        setError("Microfonul e blocat. Reîncarcă pagina.");
      } else if (code === "no-speech") {
        setError("Nu te-am auzit. Încearcă mai aproape de microfon.");
      } else if (code === "aborted") {
        // user stopped — not an error
      } else if (code) {
        setError("Dictarea n-a mers. Încearcă din nou.");
      }
      setPhase(code === "aborted" ? "idle" : "error");
    };
    rec.onend = () => {
      // Procesarea finală e triggerată în stopListening, nu aici
    };
    try {
      rec.start();
      recRef.current = rec;
      lastFinalAtRef.current = 0;
      // Hard-stop la 60s ca să prevenim hold-out infinit
      stopTimerRef.current = setTimeout(() => stopListening(), 60_000);
    } catch {
      setError("Nu s-a putut porni microfonul.");
      setPhase("error");
    }
  };

  const stopListening = async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    try { recRef.current?.stop(); } catch { /* noop */ }
    recRef.current = null;
    setInterim("");

    if (!transcript.trim()) {
      setPhase("idle");
      return;
    }
    // PHASE processing — paralel: AI classify + geolocation
    setPhase("processing");
    try {
      const [classifyRes, locationRes] = await Promise.allSettled([
        fetch("/api/ai/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript }),
        }).then((r) => r.json()),
        new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("no geo"));
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (e) => reject(e),
            { enableHighAccuracy: true, timeout: 10_000 },
          );
        }),
      ]);

      if (classifyRes.status === "fulfilled" && classifyRes.value?.data?.tip) {
        setTip(classifyRes.value.data.tip);
      } else {
        setTip("altele");
      }

      if (locationRes.status === "fulfilled") {
        const { lat: la, lng: ln } = locationRes.value;
        setLat(la);
        setLng(ln);
        // Reverse geocode pentru locatie + sector
        try {
          const geo = await fetch(`/api/geocode?lat=${la}&lng=${ln}`).then((r) => r.json());
          if (geo.data) {
            setLocatie(geo.data.address || `Lat ${la.toFixed(4)}, Lng ${ln.toFixed(4)}`);
            if (geo.data.sector) setSector(geo.data.sector);
            else setSector(detectSectorFromCoords(la, ln) ?? null);
          }
        } catch {
          setLocatie(`Lat ${la.toFixed(4)}, Lng ${ln.toFixed(4)}`);
          setSector(detectSectorFromCoords(la, ln) ?? null);
        }
      }

      setPhase("review");
    } catch {
      setPhase("review"); // continuăm chiar dacă au eșuat — userul completează manual
    }
  };

  const goToFullForm = () => {
    // Persistă transcript-ul în localStorage ca DRAFT pentru formularul complet
    try {
      const draft = {
        descriere: transcript,
        tip,
        locatie,
        sector,
        lat,
        lng,
      };
      localStorage.setItem("civia_voice_draft", JSON.stringify(draft));
    } catch { /* quota */ }
    if (typeof window !== "undefined") {
      window.location.href = "/sesizari?from=voice";
    }
  };

  // ─── RENDER ───
  if (phase === "review") {
    const tipLabel = SESIZARE_TIPURI.find((t) => t.value === tip)?.label ?? "—";
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 space-y-5 shadow-[var(--shadow-2)]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-purple-500" aria-hidden="true" />
          <h2 className="font-semibold text-base">Am înțeles asta:</h2>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Ai descris:</span>
            <p className="text-sm leading-relaxed bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-3 mt-1">
              {transcript}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Tip detectat</span>
              <p className="text-sm font-medium mt-1">{tipLabel}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Locație</span>
              <p className="text-sm font-medium mt-1 inline-flex items-center gap-1">
                <MapPin size={11} aria-hidden="true" />
                {locatie || "—"}
                {sector && <span className="text-[var(--color-text-muted)]"> · {sector}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => {
              if (!user) {
                openAuthModal();
                return;
              }
              goToFullForm();
            }}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            <Send size={14} aria-hidden="true" />
            Verifică și trimite
          </button>
          <button
            type="button"
            onClick={() => {
              setTranscript("");
              setTip("");
              setLocatie("");
              setSector(null);
              setPhase("idle");
            }}
            className="w-full h-10 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded transition-colors"
          >
            Reia de la zero
          </button>
        </div>

        <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed">
          Vei vedea formularul complet preumplut. Verifică, adaugă o poză dacă vrei, AI rescrie textul formal când apeși Trimite.
        </p>
      </div>
    );
  }

  // PHASE idle / listening / processing / error
  const isListening = phase === "listening";
  const isProcessing = phase === "processing";

  return (
    <div className="space-y-5 text-center">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        aria-label={isListening ? "Oprește dictarea" : "Apasă și vorbește"}
        className={`mx-auto inline-flex items-center justify-center w-32 h-32 rounded-full shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary)] disabled:opacity-50 ${
          isListening
            ? "bg-red-500 text-white animate-pulse scale-110"
            : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] hover:scale-105"
        }`}
      >
        {isProcessing ? (
          <Loader2 size={48} className="animate-spin" aria-hidden="true" />
        ) : isListening ? (
          <MicOff size={48} aria-hidden="true" />
        ) : (
          <Mic size={48} aria-hidden="true" />
        )}
      </button>

      <div className="min-h-[60px]">
        {phase === "idle" && (
          <>
            <p className="text-base font-semibold">Apasă și vorbește</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Spune liber ce vezi. Locația și tipul le detectăm noi.
            </p>
          </>
        )}
        {isListening && (
          <>
            <p className="text-sm font-semibold text-red-500">Te ascult — apasă din nou pentru stop</p>
            {interim && (
              <p className="text-xs italic text-[var(--color-text-muted)] mt-1 max-w-md mx-auto">
                „{interim}…"
              </p>
            )}
            {transcript && (
              <p className="text-sm mt-2 max-w-md mx-auto leading-relaxed">
                {transcript}
              </p>
            )}
          </>
        )}
        {isProcessing && (
          <p className="text-sm text-[var(--color-text-muted)]">
            AI procesează… detectez tipul și locația…
          </p>
        )}
        {phase === "error" && error && (
          <div className="text-sm text-red-500 max-w-md mx-auto">
            {error}
            <button
              type="button"
              onClick={() => { setError(null); setPhase("idle"); }}
              className="block mt-2 mx-auto text-xs text-[var(--color-primary)] hover:underline"
            >
              Încearcă din nou
            </button>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          Preferi să scrii?{" "}
          <Link href="/sesizari" className="text-[var(--color-primary)] hover:underline font-medium">
            Folosește formularul complet
          </Link>
        </p>
      </div>
    </div>
  );
}
