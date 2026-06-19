"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X, Share, Plus, Bell, Zap, WifiOff } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "civia_install_dismissed";
const VISIT_COUNT_KEY = "civia_visit_count";
const UPDATE_DISMISS_KEY = "civia_sw_update_dismissed";
// Conversion 0.84% (după bump la 3 vizite). Mai mult zgomot decât
// instalări — bump la 6 vizite + 60 zile între dismiss-uri. Userii care
// chiar vor PWA o vor instala oricum manual; restul beneficiază de un
// site mai liniștit.
// 10 vizite minimum — utilizatorul s-a obișnuit cu site-ul. Era 6, dar
// rata de dismiss confirmă că „6 vizite" nu inseamna user angajat.
const MIN_VISITS_BEFORE_PROMPT = 10;
// 90 days TTL — user a dismis prompt-ul, nu il bombardam. Analytics
// 5/19/2026: 88% dismiss-before-submit pe install prompt → mult prea agresiv.
const DISMISS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Already running as a standalone PWA — don't show install UI. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari uses navigator.standalone instead of the W3C media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True for iOS Safari (Chrome on iOS uses WebKit too — handled below). */
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // iPadOS reports as Mac on iPad; the touch check disambiguates.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** True specifically for iOS Safari (PWA install isn't supported in
 *  iOS Chrome / Firefox webviews — they reuse Safari's stack but
 *  don't expose Add-to-Home-Screen). */
function isIOSSafari(): boolean {
  if (!isIOS()) return false;
  const ua = window.navigator.userAgent;
  // Excludes CriOS (Chrome iOS), FxiOS (Firefox iOS), EdgiOS (Edge iOS)
  return !/CriOS|FxiOS|EdgiOS|GSA/.test(ua) && /Safari/.test(ua);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  // Tipul de dispozitiv — textul se adaptează (telefon vs calculator/laptop).
  const [isMobile, setIsMobile] = useState(false);
  // 2026-06-19 — guard reapariție după dismiss + un singur timer de afișare
  // (beforeinstallprompt poate „refire" → promptul reapărea după câteva secunde).
  const dismissedRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register the service worker once + listen for update events
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Only register in production to avoid dev-mode caching headaches
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // If a worker is already waiting (user previously dismissed
        // the update prompt and reopened the tab), surface again.
        if (reg.waiting) {
          setUpdateReady(true);
        }
        // New SW arrived during this session — wait for install,
        // then prompt to refresh.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Respect user dismissal of an earlier update prompt for 4h
              const dismissedAt = parseInt(
                localStorage.getItem(UPDATE_DISMISS_KEY) ?? "0",
                10,
              );
              if (Date.now() - dismissedAt < 4 * 60 * 60 * 1000) return;
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        // silent fail — SW is progressive enhancement
      });

    // Reload once when the new SW takes over (after we postMessage
    // SKIP_WAITING). The `controller` change fires after activate.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // 2026-05-29 — Ascultam CIVIA_SW_HARD_RELOAD trimis cand SW v11+ se
    // activeaza (contine fix critic JSON parse). Reload automat fara UI
    // prompt pentru a evita ca userii sa ramana pe bundle vechi.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "CIVIA_SW_HARD_RELOAD" && !reloaded) {
        reloaded = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  // Increment visit counter on every mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10) + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(count));
    } catch {
      /* quota ignored */
    }
  }, []);

  // Detectează telefon vs desktop — promptul de install apare pe Chrome
  // ȘI pe desktop ȘI pe Android, deci textul trebuie să se potrivească.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  }, []);

  // Listen for Chrome's install prompt event
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // Already installed

    // Respect user dismissal (shows again after 30 days)
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;
    }

    // Visit-count gate — don't bother first-time visitors
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10);
    if (visitCount < MIN_VISITS_BEFORE_PROMPT) return;

    // Skip prompt pe paginile critice de flow — utilizatorul e in mijlocul
    // unei sesizari/petitii si popup-ul intrerupe. Mai bine surfacing pe
    // pagini calme (sesizare detail, /cont, homepage post-action).
    const path = window.location.pathname;
    const interruptiveRoutes = ["/sesizari", "/petitii/initiaza", "/sesizari/voce"];
    if (interruptiveRoutes.some((r) => path === r)) return;

    // iOS Safari path — no `beforeinstallprompt` event exists; we
    // surface manual A2HS instructions instead. Delay 15s — generos
    // pentru ca userul sa intre in lectura, nu sa primeasca popup la load.
    if (isIOSSafari()) {
      const t = setTimeout(() => { if (!dismissedRef.current) setIosVisible(true); }, 15_000);
      return () => clearTimeout(t);
    }

    // Chrome / Edge / Samsung Internet path — wait for the event.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay 15s (de la 5s) — analytics 5/19/2026 a aratat ca 88% dismiss
      // inainte de submit. Userul nu apucase sa se obisnuiasca cu site-ul.
      // Guard: dacă userul a închis deja în sesiune NU mai reapărem; un singur
      // timer (evenimentul poate refire → reapariție „bug" raportată de user).
      if (dismissedRef.current || showTimerRef.current) return;
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        if (dismissedRef.current || isStandalone()) return;
        setVisible(true);
      }, 15_000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (typeof window !== "undefined") {
      import("@/components/analytics/CiviaTracker")
        .then(({ trackCustomEvent }) => {
          trackCustomEvent(
            choice.outcome === "accepted" ? "pwa-install-accepted" : "pwa-install-dismissed",
          );
        })
        .catch(() => {
          /* ignore */
        });
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const dismiss = () => {
    // Închidere STICKY pe sesiune: nu mai reapărem (era bug — „Mai târziu" și
    // promptul revenea după câteva secunde la refire-ul evenimentului).
    dismissedRef.current = true;
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    import("@/components/analytics/CiviaTracker")
      .then(({ trackCustomEvent }) => {
        trackCustomEvent("pwa-install-dismissed-before-show");
      })
      .catch(() => {
        /* ignore */
      });
    setVisible(false);
    setIosVisible(false);
  };

  const applyUpdate = () => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
    // The `controllerchange` listener above will reload the page
    // once the new SW takes over. No state cleanup needed.
  };

  const dismissUpdate = () => {
    localStorage.setItem(UPDATE_DISMISS_KEY, Date.now().toString());
    setUpdateReady(false);
  };

  // ─── Update-ready pill (highest priority — surfaces over install) ───
  if (updateReady) {
    return (
      <div
        role="status"
        className="fixed left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[var(--z-install-prompt)] animate-fade-in-up"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
      >
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-4 flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-[var(--radius-xs)] bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center text-white">
            <Download size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-0.5">Versiune nouă disponibilă</p>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Reîncarcă pagina ca să folosești cea mai nouă versiune Civia.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyUpdate}
                className="h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] transition-colors"
              >
                Reîncarcă acum
              </button>
              <button
                type="button"
                onClick={dismissUpdate}
                className="h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs font-medium hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
              >
                Mai târziu
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissUpdate}
            className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] -mt-1 -mr-1 p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Închide notificarea de actualizare"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // ─── iOS A2HS instructions ────────────────────────────────────────
  if (iosVisible) {
    return (
      <div
        role="dialog"
        aria-labelledby="install-prompt-ios-title"
        className="fixed left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[var(--z-install-prompt)] animate-fade-in-up"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
      >
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="shrink-0 w-10 h-10 rounded-[var(--radius-xs)] bg-gradient-to-br from-[var(--color-primary)] to-indigo-900 grid place-items-center text-white">
              <Download size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                id="install-prompt-ios-title"
                className="font-semibold text-sm mb-0.5"
              >
                Pune Civia pe iPhone
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Apasă <Share size={11} className="inline -mt-0.5" aria-label="Share" /> jos în Safari, apoi „Adaugă pe ecran principal" <Plus size={11} className="inline -mt-0.5" aria-label="Plus" />.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] -mt-1 -mr-1 p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Închide promptul de instalare"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-full h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs font-medium hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
          >
            Am înțeles
          </button>
        </div>
      </div>
    );
  }

  // ─── Standard Chrome / Edge install prompt ─────────────────────────
  if (!visible || !deferredPrompt) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-prompt-title"
      className="fixed left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[var(--z-install-prompt)] animate-fade-in-up"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
    >
      {/* 5/22/2026 — rebrand cu beneficii concrete. Analytics arăta 0.5%
          install rate (3.7k prompts → 18 installs). Acum 3 beneficii
          vizuale clare → click pe „Instalează acum" devine no-brainer. */}
      <div className="glass-surface-strong rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-4 relative">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Închide promptul de instalare"
        >
          <X size={14} aria-hidden="true" />
        </button>
        <div className="flex items-start gap-3 mb-3 pr-6">
          <div className="shrink-0 w-10 h-10 rounded-[var(--radius-xs)] bg-gradient-to-br from-[var(--color-primary)] to-emerald-900 grid place-items-center text-white">
            <Download size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p id="install-prompt-title" className="font-semibold text-sm mb-0.5">
              Civia ca aplicație pe {isMobile ? "telefon" : "calculator"}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              {isMobile
                ? "Un tap din ecranul principal, fără bara de browser. Funcționează ca o app nativă."
                : "Un click și se deschide ca o aplicație separată, fără bara de browser."}
            </p>
          </div>
        </div>
        {/* 3 beneficii concrete cu iconuri */}
        <ul className="space-y-2 mb-3 text-xs">
          <li className="flex items-start gap-2">
            <Bell size={14} className="text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <span><strong>Notificări push</strong> când primăria răspunde la sesizarea ta</span>
          </li>
          <li className="flex items-start gap-2">
            <Zap size={14} className="text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <span><strong>Se deschide instant</strong> — fără să mai aștepți browserul</span>
          </li>
          <li className="flex items-start gap-2">
            <WifiOff size={14} className="text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <span><strong>Funcționează offline</strong> — ghiduri + sesizări pendinte</span>
          </li>
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={install}
            className="flex-1 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] transition-colors"
          >
            Instalează acum
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs font-medium hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
          >
            Mai târziu
          </button>
        </div>
      </div>
    </div>
  );
}
