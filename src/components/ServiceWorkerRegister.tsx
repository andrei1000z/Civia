"use client";

import { useEffect } from "react";

/**
 * Înregistrează service worker-ul DEVREME (la hidratare), NU deferred.
 *
 * Înainte, registration trăia doar în <InstallPrompt>, montat în
 * <DeferredClientMount> (după first paint + idle) → crawlerele (PWABuilder)
 * și uneori Chrome nu-l detectau la timp („did not find a Service Worker").
 * register() e idempotent, deci nu intră în conflict cu wiring-ul de update
 * din InstallPrompt (acela primește aceeași registration).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW e best-effort — site-ul funcționează și fără el */
    });
  }, []);
  return null;
}
