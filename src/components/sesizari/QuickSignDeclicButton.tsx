"use client";

import { useState } from "react";
import { Zap, ExternalLink, X, Bookmark, MousePointerClick, ArrowRight } from "lucide-react";

interface Props {
  signUrl: string;
  petitieTitle: string;
  externalHost: string | null;
  ariaLabel: string;
}

const ACK_KEY = "civia.quicksign.bookmarklet.acknowledged";

/**
 * Buton „Semnează rapid" cu modal de instrucțiuni first-time.
 * Declic NU citește URL params (verified 5/23/2026 — JS bundle nu are
 * URLSearchParams). Singura cale e bookmarklet-ul user-side. Modal-ul
 * arată instrucțiuni la primul click; localStorage „acknowledged" face
 * skip pentru următoarele click-uri.
 */
export function QuickSignDeclicButton({
  signUrl,
  petitieTitle,
  externalHost,
  ariaLabel,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const openDeclic = () => {
    window.open(signUrl, "_blank", "noopener,noreferrer");
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check first-time
    let acked = false;
    try {
      acked = localStorage.getItem(ACK_KEY) === "1";
    } catch {/* localStorage blocked */}
    if (acked) {
      openDeclic();
    } else {
      setShowModal(true);
    }
  };

  const confirmAndOpen = () => {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {/* noop */}
    setShowModal(false);
    openDeclic();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        className="relative z-[2] inline-flex items-center justify-center gap-1.5 w-full h-9 px-3 rounded-[var(--radius-button)] bg-gradient-to-br from-emerald-500/95 to-cyan-500/95 text-white text-xs font-bold transition-all shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)] hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
      >
        <Zap size={12} aria-hidden="true" />
        Semnează rapid
        <ExternalLink size={10} aria-hidden="true" />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quicksign-modal-title"
        >
          <div
            className="relative w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] inline-flex items-center justify-center transition-colors"
              aria-label="Închide"
            >
              <X size={14} />
            </button>

            <div className="w-10 h-10 rounded-[var(--radius-xs)] bg-emerald-500/15 grid place-items-center mb-3">
              <Zap size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </div>

            <h3
              id="quicksign-modal-title"
              className="font-[family-name:var(--font-sora)] font-bold text-base mb-2 leading-tight"
            >
              Cum se completează formularul automat
            </h3>

            <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
              Declic <strong>nu permite</strong> completarea direct din link, deci
              folosim un mic „buton magic" (bookmarklet) pe care îl pui o dată în
              bara de favorite a browser-ului.
            </p>

            <ol className="space-y-3 mb-5 text-sm">
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center justify-center mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-semibold">Instalează bookmark-ul Civia</p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                    În <a
                      href="/cont#quick-sign"
                      target="_blank"
                      rel="noopener"
                      className="text-emerald-600 dark:text-emerald-400 underline font-medium"
                    >
                      /cont
                    </a>, trage butonul „Civia: completează automat" în bara de
                    favorite (apasă <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-mono text-[10px]">Ctrl+Shift+B</kbd> dacă nu o vezi).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center justify-center mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-semibold">Deschide pagina Declic</p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                    Apeși butonul „Continuă pe {externalHost ?? "Declic"}" mai jos
                    — se deschide într-un tab nou.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center justify-center mt-0.5">
                  3
                </span>
                <div>
                  <p className="font-semibold">Click pe bookmark</p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                    În tab-ul Declic, click pe „Civia: completează automat" din bara
                    de favorite → formularul se completează singur. Tu apeși
                    „Semnează" și gata.
                  </p>
                </div>
              </li>
            </ol>

            <div className="flex items-center gap-2 mb-3">
              <Bookmark
                size={12}
                className="text-emerald-600 dark:text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                <strong>Setezi 1 dată, folosești de zeci de ori.</strong> Bookmark-ul
                e personal — datele nu părăsesc browser-ul tău.
              </p>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={confirmAndOpen}
                className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[var(--radius-button)] bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)] hover:brightness-110 active:scale-[0.97]"
              >
                <MousePointerClick size={14} aria-hidden="true" />
                Continuă pe {externalHost ?? "Declic"}
                <ArrowRight size={12} aria-hidden="true" />
              </button>
              <a
                href="/cont#quick-sign"
                target="_blank"
                rel="noopener"
                className="w-full inline-flex items-center justify-center gap-1 h-9 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-xs font-medium transition-colors"
              >
                Mai întâi setez bookmark-ul →
              </a>
            </div>

            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <p className="text-[10px] text-[var(--color-text-muted)] mt-3 text-center leading-relaxed">
              Mesajul ăsta apare doar prima dată. Petiție:{" "}
              <strong className="text-[var(--color-text)]">{petitieTitle.slice(0, 60)}</strong>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
