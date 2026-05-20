"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Message to announce — when changes, SR reads it aloud (polite). */
  message?: string;
  /** Priority — polite (waits) or assertive (interrupts). Default polite. */
  priority?: "polite" | "assertive";
}

/**
 * LiveAnnouncer — screen reader announcement helper.
 *
 * Folosit pentru a anunta evenimente UI catre screen reader-uri fără
 * să forțezi focus shift. Standard A11y pattern (`aria-live`).
 *
 * Usage:
 *   <LiveAnnouncer message={submitStatus} />
 *
 * Cand `message` se schimba, SR citește noul text. Polite = nu
 * întrerupe ce citește acum. Assertive = întrerupe.
 */
export function LiveAnnouncer({ message, priority = "polite" }: Props) {
  const [current, setCurrent] = useState("");

  useEffect(() => {
    if (!message) return;
    // Clear first, then set after a tick — forces SR to re-read even if
    // identical message comes twice (e.g., multiple errors of same type).
    setCurrent("");
    const t = setTimeout(() => setCurrent(message), 50);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {current}
    </div>
  );
}

/**
 * Imperative-style announcer — folosit cand vrei sa anunti dintr-un
 * callback (nu state-driven). Mounted o data in layout, apoi orice
 * componenta poate face `window.dispatchEvent(...)`
 */
export function GlobalLiveAnnouncer() {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; priority?: "polite" | "assertive" }>).detail;
      if (!detail?.text) return;
      const target = detail.priority === "assertive" ? assertiveRef.current : politeRef.current;
      if (!target) return;
      // Clear + set pattern (SR re-reads even if identical)
      target.textContent = "";
      setTimeout(() => {
        if (target) target.textContent = detail.text;
      }, 50);
    };
    window.addEventListener("civia:announce", handler as EventListener);
    return () => window.removeEventListener("civia:announce", handler as EventListener);
  }, []);

  return (
    <>
      <div ref={politeRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div ref={assertiveRef} role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />
    </>
  );
}

/**
 * Imperative API: announce() dispatches event for GlobalLiveAnnouncer.
 *
 * Usage:
 *   import { announce } from "@/components/ui/LiveAnnouncer";
 *   announce("Sesizarea a fost trimisă");
 *   announce("Eroare la upload", "assertive");
 */
export function announce(text: string, priority: "polite" | "assertive" = "polite"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("civia:announce", { detail: { text, priority } }));
}
