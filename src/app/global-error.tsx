"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. Catches errors thrown in the ROOT layout
 * (and in error.tsx itself) — cases the per-segment `error.tsx` cannot
 * reach. Next.js renders this WITHOUT the root layout, so it must supply
 * its own <html>/<body> and cannot rely on globals.css / design tokens
 * being loaded → all styling is inline + self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error (root):", error);
  }, [error]);

  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#FAFAFA",
          color: "#18181B",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div role="alert" aria-live="assertive" style={{ maxWidth: 460, textAlign: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 24px",
              borderRadius: 9999,
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Ceva nu a mers bine
          </h1>
          <p style={{ color: "#71717A", margin: "0 0 8px", lineHeight: 1.6, fontSize: 15 }}>
            Aplicația a întâmpinat o eroare neașteptată. Apasă „Reîncarcă" și încearcă din nou. Dacă se
            repetă, scrie-ne și ne uităm la ce s-a întâmplat.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#a1a1aa", margin: "8px 0 0" }}>
              Cod eroare: {error.digest}
            </p>
          )}
          <div style={{ marginTop: 28 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 44,
                padding: "0 24px",
                borderRadius: 10,
                background: "#059669",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reîncarcă pagina
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error înlocuiește root layout-ul după un crash; <a> face hard-reload (resetează complet starea), iar router/Link context e indisponibil aici */}
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 44,
                padding: "0 24px",
                marginLeft: 12,
                borderRadius: 10,
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                color: "#18181B",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Înapoi acasă
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
