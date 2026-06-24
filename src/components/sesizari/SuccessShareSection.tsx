"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { withRef } from "@/lib/referral/client";

/**
 * Secțiune de distribuire post-trimitere — refolosită pe SuccessScreen (după
 * depunere) ȘI în modalul „Trimite și tu" (după co-semnare). Scop: viralitate +
 * SEO (fiecare share = link către sesizare). FĂRĂ Reddit (cerere user) — doar
 * WhatsApp / Telegram / Bluesky / Facebook / X + share nativ pe mobil + copiere.
 */
export function SuccessShareSection({
  code,
  title,
  source = "success-screen",
  className,
}: {
  code: string;
  title: string;
  source?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  // Micro-recompensă după un share reușit → încurajează al doilea share.
  const [justShared, setJustShared] = useState(false);

  // Referral (Faza 1) — atașăm ?ref={codul meu} pe link după mount (cookie
  // civia_rc, citit client-side). Anonim → fără cod, url neschimbat.
  const baseUrl = `https://civia.ro/sesizari/${code}`;
  const [url, setUrl] = useState(baseUrl);
  useEffect(() => {
    setUrl(withRef(baseUrl));
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, [baseUrl]);

  const shareText = `Am trimis o sesizare pe Civia: „${title}". Mai multe voci → primăria mișcă mai repede. Trimite și tu în 90 de secunde 👇`;

  const trackShare = (channel: string) => {
    setJustShared(true);
    setTimeout(() => setJustShared(false), 2500);
    import("@/components/analytics/CiviaTracker")
      .then(({ trackCustomEvent }) => trackCustomEvent("share", { channel, url, source }))
      .catch(() => {});
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "Civia — sesizare", text: shareText, url });
      trackShare("native");
    } catch {
      /* user a anulat — silent */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setCopied(true);
      trackShare("clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const blueskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const tileTop =
    "inline-flex flex-col items-center justify-center gap-1 h-16 rounded-[var(--radius-xs)] text-white hover:opacity-90 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2";
  const tileBottom =
    "inline-flex flex-col items-center justify-center gap-1 h-12 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

  return (
    <div className={`pt-5 border-t border-[var(--color-border)] text-left ${className ?? ""}`}>
      <p className="text-sm font-semibold mb-1 text-[var(--color-text)] text-center transition-colors">
        {justShared
          ? "🙌 Mulțumim! Fiecare distribuire aduce o voce în plus."
          : "Distribuie — și alții pot trimite în 90 de secunde"}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed text-center">
        Cu cât mai mulți cetățeni semnalează aceeași problemă, cu atât primăria răspunde mai repede.
      </p>

      {/* Mobil — share nativ (deschide TOATE aplicațiile printr-un tap). */}
      {canNativeShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="lc-liquid lc-magnetic w-full h-12 mb-3 rounded-[var(--radius-full)] bg-gradient-to-br from-emerald-500/90 to-cyan-500/90 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          <Share2 size={16} aria-hidden="true" />
          Distribuie acum
        </button>
      )}

      {/* 2026-06-24 — în RO WhatsApp + Facebook domină share-ul, deci ele +
          „Copiază" stau în rândul proeminent (colorat). Telegram/Bluesky/X
          coboară în rândul secundar. Înainte Facebook era degradat la gri. */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackShare("whatsapp")} className={`${tileTop} bg-[#25D366]`} aria-label="Distribuie pe WhatsApp">
          <span className="text-xl" aria-hidden="true">💬</span>
          <span className="text-[10px] font-medium">WhatsApp</span>
        </a>
        <a href={facebookUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackShare("facebook")} className={`${tileTop} bg-[#1877F2]`} aria-label="Distribuie pe Facebook">
          <span className="text-xl font-bold" aria-hidden="true">f</span>
          <span className="text-[10px] font-medium">Facebook</span>
        </a>
        <button type="button" onClick={copyLink} className={`${tileTop} bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]`} aria-label="Copiază link-ul">
          <span className="text-xl" aria-hidden="true">{copied ? "✓" : "🔗"}</span>
          <span className="text-[10px] font-medium">{copied ? "Copiat!" : "Copiază"}</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackShare("telegram")} className={tileBottom} aria-label="Distribuie pe Telegram">
          <span aria-hidden="true">✈️</span>
          <span className="text-[10px]">Telegram</span>
        </a>
        <a href={blueskyUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackShare("bluesky")} className={tileBottom} aria-label="Distribuie pe Bluesky">
          <span aria-hidden="true">🦋</span>
          <span className="text-[10px]">Bluesky</span>
        </a>
        <a href={twitterUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackShare("twitter")} className={tileBottom} aria-label="Distribuie pe X (Twitter)">
          <span className="font-bold" aria-hidden="true">𝕏</span>
          <span className="text-[10px]">X</span>
        </a>
      </div>
    </div>
  );
}
