"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, MessageCircle, Send, Link2, QrCode, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { QR_API_BASE_URL } from "@/lib/constants";
import { withRef } from "@/lib/referral/client";

interface Props {
  url: string;
  title: string;
  /** Mesaj bogat de „acțiune" pentru body-ul share-ului (WhatsApp/Telegram/…).
   *  Ex: „Am trimis o sesizare pentru montare stâlpișori pe Str. X. Trimite și
   *  tu:". Dacă lipsește, cade pe „{title} - Civia". */
  message?: string;
  size?: "sm" | "md" | "lg";
  /** „accent" = trigger evidențiat (tentă de primary) pentru suprafețele unde
   *  vrem viralitate (pagina publică a sesizării). „muted" (default) = gri. */
  variant?: "muted" | "accent";
}

export function ShareMenu({ url, title, message, size = "sm", variant = "muted" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  // Direction smart: cand butonul e in jumatatea de sus a viewport-ului
  // deschidem in jos, altfel in sus. Inainte era hard-coded „bottom-full"
  // care taia meniul cand butonul era langa top (pagina sesizare detail).
  const [direction, setDirection] = useState<"up" | "down">("down");
  // Înălțimea max calculată la deschidere (spațiul real disponibil) → meniul nu
  // mai e niciodată „tăiat", ci derulează intern dacă nu încape.
  const [menuMaxH, setMenuMaxH] = useState<number>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Referral (Faza 1) — după mount, adaugă ?ref={codul meu} pe URL-ul de share
  // (cookie-ul civia_rc e citit client-side). La SSR/prim render folosim url-ul
  // simplu; meniul se deschide doar după mount, deci share-urile poartă ref-ul.
  const [shareUrl, setShareUrl] = useState(url);
  useEffect(() => {
    setShareUrl(withRef(url));
  }, [url]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (qrOpen) setQrOpen(false);
      else if (open) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, qrOpen]);

  // Text de share — caller-ul poate trimite un mesaj „acțiune" (ex: „Am trimis
  // o sesizare pentru X la Y. Trimite și tu:"); altfel titlu + Civia.
  const fullText = message ?? `${title} - Civia`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${fullText}\n${shareUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(fullText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  // Bluesky compose intent — share text + URL via Bluesky's official intent
  // URL. Civia are deja cont @civiaro pe Bluesky, deci shares ajung in
  // ecosistemul european open-source preferat.
  const blueskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${fullText}\n${shareUrl}`)}`;
  // Reddit — submit cu titlu separat (excelent pt. cauze civice: r/Romania,
  // r/Bucuresti, r/{oras}). Title = headline-ul, url = link-ul Civia.
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  // Helper — fire a "share" custom analytics event with the channel
  // so /admin/analytics can show which sharing surfaces are hot.
  // Dynamic import keeps CiviaTracker out of the ShareMenu bundle.
  const trackShare = (channel: string) => {
    import("@/components/analytics/CiviaTracker").then(({ trackCustomEvent }) => {
      trackCustomEvent("share", { channel, url });
    }).catch(() => { /* silent */ });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${fullText}\n${shareUrl}`);
      setCopied(true);
      toast("Link copiat!", "success", 2000);
      trackShare("clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiază:", shareUrl);
    }
  };

  const qrUrl = `${QR_API_BASE_URL}?size=300x300&data=${encodeURIComponent(shareUrl)}`;

  const iconSize = size === "sm" ? 13 : size === "lg" ? 16 : 15;
  // „lg" = h-11 px-4 — la fel ca butoanele de acțiune (SignSesizare, Status etc.)
  const px = size === "sm" ? "px-2 py-1" : size === "lg" ? "h-11 px-4" : "px-3 py-1.5";
  const textSize = size === "lg" ? "text-sm" : "text-xs";

  // Prefer the native Web Share API when available (mobile browsers,
  // Chrome desktop 89+). Falls through to the menu if the user cancels
  // or the platform lacks support.
  const tryNativeShare = async (): Promise<boolean> => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share !== "function") return false;
    try {
      // 2026-06-24 — trimitem și `text` (mesajul de acțiune): pe mobil (53% din
      // trafic) share-ul nativ ducea doar titlu+link pe WhatsApp, fără îndemnul
      // care convertește. fullText = message ?? „{title} - Civia".
      await nav.share({ title, text: fullText, url: shareUrl });
      trackShare("native");
      return true;
    } catch {
      return false;
    }
  };

  return (
    <>
      <div ref={ref} className="relative inline-block" data-no-print>
        <button
          ref={triggerRef}
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            // On touch / small screens try the OS share sheet first.
            if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
              const shared = await tryNativeShare();
              if (shared) return;
            }
            // Direcție + înălțime smart, conștiente de navbar. Navbar-ul e `fixed`
            // (z-nav, ~64px) — scădem un inset ca meniul să NU se deschidă în
            // spatele lui (cauza „tăiat mâncat": primele opțiuni dispăreau sub
            // navbar). Alegem direcția cu mai mult loc REAL și plafonăm înălțimea
            // la spațiul disponibil → scroll intern dacă nu încape, niciodată tăiat.
            if (!open && triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              const NAVBAR_INSET = 76;
              const EDGE = 12;
              const GAP = 8;
              const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
              const roomAbove = rect.top - NAVBAR_INSET - GAP;
              const dir = roomBelow >= roomAbove ? "down" : "up";
              setDirection(dir);
              setMenuMaxH(Math.max(200, Math.floor(dir === "down" ? roomBelow : roomAbove)));
            }
            setOpen(!open);
          }}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-xs)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
            px,
            textSize,
            variant === "accent"
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/15"
              : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
          )}
          aria-label="Distribuie"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Share2 size={iconSize} aria-hidden="true" />
          <span>Distribuie</span>
        </button>

        {open && (
          <div
            role="menu"
            style={menuMaxH ? { maxHeight: menuMaxH } : undefined}
            // lc-nav-glass: același limbaj „liquid glass" ca meniurile din navbar
            // (Explorează / notificări) — un singur stil de meniu plutitor în app.
            // z peste navbar (z-nav=50) + scroll intern plafonat → nu mai e tăiat.
            className={cn(
              "absolute right-0 w-56 lc-nav-glass rounded-2xl overflow-y-auto overscroll-contain z-[var(--z-modal)]",
              direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
            )}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("whatsapp"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <MessageCircle size={16} className="text-[#25D366]" aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("telegram"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <Send size={16} className="text-[#0088cc]" aria-hidden="true" />
              <span>Telegram</span>
            </a>
            <a
              href={redditUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("reddit"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <span className="w-4 h-4 flex items-center justify-center rounded-full bg-[#FF4500] text-white text-[10px] font-bold" aria-hidden="true">r</span>
              <span>Reddit</span>
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("twitter"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <span className="w-4 h-4 flex items-center justify-center text-sm font-bold" aria-hidden="true">𝕏</span>
              <span>Twitter/X</span>
            </a>
            <a
              href={blueskyUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("bluesky"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <span className="w-4 h-4 flex items-center justify-center text-base font-bold text-[#0085ff]" aria-hidden="true">🦋</span>
              <span>Bluesky</span>
            </a>
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("facebook"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <span className="w-4 h-4 flex items-center justify-center text-sm font-bold text-[#1877F2]" aria-hidden="true">f</span>
              <span>Facebook</span>
            </a>
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => { setOpen(false); trackShare("linkedin"); }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-[#0A66C2]" aria-hidden="true">in</span>
              <span>LinkedIn</span>
            </a>
            <div className="border-t border-[var(--color-border)]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => { copyLink(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors text-left focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              {copied ? <Check size={16} className="text-emerald-600" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
              <span>{copied ? "Copiat!" : "Copiază link + titlu"}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setQrOpen(true); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors text-left focus:outline-none focus-visible:bg-[var(--color-surface-2)]"
            >
              <QrCode size={16} aria-hidden="true" />
              <span>QR code</span>
            </button>
          </div>
        )}
      </div>

      {qrOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal-priority)] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setQrOpen(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            className="bg-[var(--color-surface)] rounded-[var(--radius-md)] p-6 max-w-sm shadow-[var(--shadow-4)] animate-modal-pop"
          >
            <h3 id="qr-modal-title" className="font-semibold text-lg mb-3 text-[var(--color-text)] text-center">Scanează codul</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`Cod QR pentru ${shareUrl}`} className="mx-auto" width={300} height={300} />
            <p className="text-xs text-center text-[var(--color-text-muted)] mt-3 truncate" title={shareUrl}>{shareUrl}</p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setQrOpen(false)}
              className="mt-4 w-full"
            >
              Închide
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
