"use client";

import { useEffect } from "react";

/**
 * 2026-06-19 — Scroll-reveal global pentru `.lc-stagger`.
 *
 * Un singur IntersectionObserver dezvăluie fiecare grup staggered CÂND intră în
 * viewport (adaugă `.is-visible`), nu la mount. Robust (review adversarial):
 *  • `threshold: 0` — orice pixel vizibil declanșează (altfel grupurile mai înalte
 *    de ~10× viewport-ul, ex. lista de 20 sesizări pe mobil, nu ating ratio-ul și
 *    rămân ascunse pe veci);
 *  • grupurile DEJA în viewport sunt dezvăluite SINCRON la scan (above-the-fold nu
 *    stă blank până pornește observer-ul async);
 *  • `WeakSet` per-instanță (nu atribut DOM persistent) → remount Strict Mode /
 *    Fast Refresh re-observă curat, fără orfani blocați la opacity:0;
 *  • MutationObserver (debounced rAF) prinde conținutul async / rute / taburi;
 *  • fără JS / reduce-motion → CSS-ul (.lc-stagger sub scripting:enabled) lasă
 *    conținutul vizibil; setup eșuat → revealAll.
 * Montat o singură dată în root layout. Zero UI.
 */
export function StaggerReveal() {
  useEffect(() => {
    const revealAll = () =>
      document
        .querySelectorAll<HTMLElement>(".lc-stagger:not(.is-visible)")
        .forEach((el) => el.classList.add("is-visible"));

    if (typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    try {
      const seen = new WeakSet<Element>();
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              io.unobserve(e.target);
            }
          }
        },
        // threshold 0 → orice intersecție declanșează (sigur și pt. grupuri foarte
        // înalte). rootMargin jos negativ = mic lead-in „site viu".
        { threshold: 0, rootMargin: "0px 0px -6% 0px" },
      );

      const inViewport = (el: Element) => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        return r.top < vh * 0.94 && r.bottom > 0;
      };

      const scan = () => {
        document
          .querySelectorAll<HTMLElement>(".lc-stagger:not(.is-visible)")
          .forEach((el) => {
            if (seen.has(el)) return;
            seen.add(el);
            // deja în viewport (above-the-fold) → dezvăluie acum, fără blank
            if (inViewport(el)) {
              el.classList.add("is-visible");
              return;
            }
            io.observe(el);
          });
      };
      scan();

      // Prinde grupurile randate ulterior (async / rută / taburi) — debounced.
      let raf = 0;
      const mo = new MutationObserver(() => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          scan();
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });

      return () => {
        io.disconnect();
        mo.disconnect();
        if (raf) cancelAnimationFrame(raf);
      };
    } catch {
      revealAll();
    }
  }, []);

  return null;
}
