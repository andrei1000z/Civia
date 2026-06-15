"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Offline indicator banner — afișează un banner sticky-top când
 * navigator.onLine devine false. Dispare automat când conexiunea revine.
 *
 * 2026-05-24 (P1.320-322) audit P1: lipsea indicator vizibil pe offline,
 * user-ul submitea formularul gândind că se trimite când de fapt zacea în
 * IndexedDB queue. Acum:
 *   - online → false: banner roșu sus + mesaj „Offline. Datele se vor
 *     sincroniza când revine internetul."
 *   - online → true (după ce a fost offline): banner verde 3s „Conectat,
 *     sincronizez..."
 *
 * Folosește Background Sync API pattern 2026 (PWA spec). Nu mut state la
 * server — local doar.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!mounted) return null;
  if (online && !showReconnected) return null;

  if (!online) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-[200] bg-rose-600 text-white text-center text-sm py-2 px-4 shadow-[var(--shadow-3)] flex items-center justify-center gap-2"
      >
        <WifiOff size={14} aria-hidden="true" />
        <span>
          Offline. Datele tale se vor sincroniza când revine internetul.
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[200] bg-emerald-600 text-white text-center text-sm py-2 px-4 shadow-[var(--shadow-3)] flex items-center justify-center gap-2 animate-fade-in"
    >
      <Wifi size={14} aria-hidden="true" />
      <span>Conectat, sincronizez datele...</span>
    </div>
  );
}
