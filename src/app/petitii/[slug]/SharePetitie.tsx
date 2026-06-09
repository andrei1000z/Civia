"use client";

import { useState, useEffect, useRef } from "react";
import {
  Share2,
  Link2,
  Check,
  Mail,
  X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { withRef } from "@/lib/referral/client";

interface Props {
  url: string;          // absolute URL
  title: string;
  summary: string;
}

/**
 * Share buttons pentru petiții — multi-platform.
 *
 * Strategie:
 * - Native Web Share API (mobile-first) → user-ul alege orice app instalată,
 *   inclusiv Instagram + TikTok care n-au URL share publice.
 * - Deep links pentru platformele cu sharer URL stabil:
 *   X (Twitter), Facebook, Bluesky, LinkedIn, Reddit, WhatsApp, Telegram, Email.
 * - Copy link ca fallback universal.
 *
 * Notă: Instagram + TikTok NU au sharer URL publice. Pe mobile, native share
 * deschide picker-ul OS care le include. Pe desktop, sugerăm copy link.
 */
export function SharePetitie({ url, title, summary }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Referral (Faza 1) — atașăm ?ref={codul meu} pe link-ul partajat după mount.
  const [shareUrl, setShareUrl] = useState(url);
  useEffect(() => {
    setShareUrl(withRef(url));
  }, [url]);

  const text = title;
  const longText = `${title}\n\n${summary.slice(0, 200)}\n\n${shareUrl}`;
  const enc = encodeURIComponent;

  // audit fix (a11y): focus trap + Escape + restaurare focus pe trigger la închidere.
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!, last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  const links = [
    {
      id: "twitter",
      label: "X / Twitter",
      bg: "bg-black hover:bg-zinc-900",
      icon: <SvgX />,
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}`,
    },
    {
      id: "bluesky",
      label: "Bluesky",
      bg: "bg-sky-500 hover:bg-sky-600",
      icon: <SvgBluesky />,
      // Bluesky intent compose: text-only, includem URL în text
      href: `https://bsky.app/intent/compose?text=${enc(`${text}\n${shareUrl}`)}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      bg: "bg-blue-600 hover:bg-blue-700",
      icon: <SvgFacebook />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      bg: "bg-emerald-600 hover:bg-emerald-700",
      icon: <SvgWhatsApp />,
      href: `https://wa.me/?text=${enc(`${text} ${shareUrl}`)}`,
    },
    {
      id: "telegram",
      label: "Telegram",
      bg: "bg-sky-600 hover:bg-sky-700",
      icon: <SvgTelegram />,
      href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(text)}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      bg: "bg-blue-700 hover:bg-blue-800",
      icon: <SvgLinkedin />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`,
    },
    {
      id: "reddit",
      label: "Reddit",
      bg: "bg-orange-600 hover:bg-orange-700",
      icon: <SvgReddit />,
      href: `https://reddit.com/submit?url=${enc(shareUrl)}&title=${enc(text)}`,
    },
    {
      id: "email",
      label: "Email",
      bg: "bg-slate-600 hover:bg-slate-700",
      icon: <Mail size={18} aria-hidden="true" />,
      href: `mailto:?subject=${enc(text)}&body=${enc(longText)}`,
    },
  ] as const;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast("Link copiat", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Nu am putut copia", "error");
    }
  };

  const handleNative = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      // Fallback la copy
      handleCopy();
      return;
    }
    try {
      await navigator.share({ title, text: summary.slice(0, 200), url: shareUrl });
    } catch {
      // User canceled — silent.
    }
  };

  // Detect if mobile (rough check via UA — for choosing whether to show native button prominently).
  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-full)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-label="Distribuie petiția"
      >
        <Share2 size={14} aria-hidden="true" />
        Distribuie
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            className="w-full max-w-md bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] overflow-hidden animate-modal-pop"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h2 id="share-title" className="font-[family-name:var(--font-sora)] font-bold text-base flex items-center gap-2">
                <Share2 size={16} aria-hidden="true" />
                Distribuie petiția
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Închide"
                className="w-8 h-8 rounded-full hover:bg-[var(--color-surface-2)] flex items-center justify-center transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="p-5 space-y-4">
              {/* Native share (mobile primary) */}
              {hasNativeShare && (
                <button
                  type="button"
                  onClick={handleNative}
                  className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-full)] bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                >
                  <Share2 size={16} aria-hidden="true" />
                  Deschide opțiuni native (Instagram, TikTok, etc.)
                </button>
              )}

              {/* Platform grid */}
              <div className="grid grid-cols-4 gap-3">
                {links.map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-[var(--radius-xs)] text-white transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2",
                      l.bg,
                    )}
                    title={l.label}
                  >
                    <span className="w-6 h-6 flex items-center justify-center" aria-hidden="true">
                      {l.icon}
                    </span>
                    <span className="text-[10px] font-medium leading-tight text-center">
                      {l.label}
                    </span>
                  </a>
                ))}
              </div>

              {/* Copy link */}
              <div className="pt-3 border-t border-[var(--color-border)]">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    aria-label="URL petiție"
                    className="flex-1 h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-muted)] truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      "h-10 px-4 rounded-[var(--radius-xs)] text-sm font-medium transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                      copied
                        ? "bg-emerald-500 text-white"
                        : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white",
                    )}
                  >
                    {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                    {copied ? "Copiat" : "Copiază"}
                  </button>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                  💡 Pentru Instagram / TikTok: folosește butonul „Deschide opțiuni native" (mobile)
                  sau copiază linkul și paste-uiește în story / DM.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Inline SVG icons (no extra deps) ──────────────────────────────

function SvgX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SvgBluesky() {
  return (
    <svg viewBox="0 0 600 530" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-19.766 590 68.928c0 17.704-10.149 148.83-16.106 170.14-20.703 74.043-96.245 92.91-163.54 81.464 117.687 20.03 147.629 86.378 83.04 152.72-122.65 125.99-176.32-31.61-190.06-71.99-2.516-7.395-3.692-10.852-3.701-7.912-.001 8.46.84 16.92 1.66 25.36-7.94-12.66-13.79-26.09-17.34-40.29-13.74 40.38-67.41 197.98-190.06 71.99-64.59-66.34-34.65-132.69 83.04-152.72-67.295 11.446-142.837-7.421-163.54-81.464C8.149 217.756 0 86.632 0 68.928 0-19.766 77.74 8.009 125.72 44.03h10z" />
    </svg>
  );
}

function SvgFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SvgWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.667 5.521l.297.473-1.001 3.654 3.752-.985.394.221zm9.99-5.471c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}

function SvgTelegram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function SvgLinkedin() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function SvgReddit() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}
