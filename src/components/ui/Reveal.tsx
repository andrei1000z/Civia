"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-reveal — fundația de motion Fable (2026-06-11). Adaugă clasa
 * `is-visible` când elementul intră în viewport; CSS-ul din globals.css
 * (.reveal / .reveal.is-visible) face fade+rise cu ease-out-expo.
 *
 * Sigur by-default:
 *  • fără JS (crawlere, noscript) conținutul rămâne vizibil — starea
 *    ascunsă se aplică doar sub `@media (scripting: enabled)`;
 *  • prefers-reduced-motion: tranziția devine instant (media query globală);
 *  • once — nu re-ascunde la scroll înapoi (fără „pop" enervant).
 *
 * Folosire: <Reveal><Card …/></Reveal> sau <Reveal as="section" className="…">.
 * Pentru bare care „cresc": pune clasa `bar-grow` pe fill-ul barei din interior.
 */
export function Reveal({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: "div" | "section" | "article" | "li" | "span";
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-visible");
            io.disconnect();
          }
        }
      },
      // rootMargin negativ jos: pornește puțin ÎNAINTE ca elementul să fie
      // complet în viewport — senzație de „site viu", nu de „așteaptă-mă".
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
