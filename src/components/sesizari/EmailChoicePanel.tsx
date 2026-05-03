"use client";

import { useEffect, useState } from "react";
import { Mail, Copy, Check, ExternalLink, Smartphone, Paperclip, Loader2, X, Info } from "lucide-react";
import {
  buildMailtoLink,
  buildGmailLink,
  buildOutlookLink,
  buildYahooLink,
  buildEmailPayload,
  type MailtoInput,
} from "@/lib/sesizari/mailto";
import {
  canShareWithFiles,
  shareSesizareWithAttachments,
} from "@/lib/sesizari/share-attachments";

interface Props {
  input: MailtoInput;
  compact?: boolean;
}

// Platform detection — mobile = touch + narrow viewport.
// Why this matters: on mobile, "Deschide în Gmail" (web link) opens in
// Chrome and lands users on a login screen if they aren't signed in to
// Gmail in the browser. Most Android users use the Gmail APP, not the
// web client, so the web flow fails for them. mailto: respects the OS
// default mail app (Gmail / iOS Mail / Outlook / whatever) — which is
// the right behavior on mobile.
type Platform = "mobile" | "desktop";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 768;
  return touch && narrow ? "mobile" : "desktop";
}

export function EmailChoicePanel({ input, compact }: Props) {
  const [copied, setCopied] = useState<"all" | "body" | "to" | null>(null);
  // Default "desktop" for SSR-safe first paint; flip to mobile after mount.
  // Avoids hydration mismatch on the conditional button order.
  const [platform, setPlatform] = useState<Platform>("desktop");
  // Web Share API support — checked post-mount (SSR-safe).
  // Folosim un signal `null` (necunoscut) pe server ca să nu randăm butonul
  // de share decât după ce hidratarea a confirmat suportul real.
  const [shareSupported, setShareSupported] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);

  useEffect(() => {
    // setState in effect e intenționat — citim window post-mount, server n-are.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectPlatform());
    setShareSupported(canShareWithFiles());
  }, []);

  const payload = buildEmailPayload(input);
  const hasPhotos = (input.imagini?.length ?? 0) > 0;
  // Butonul „cu poze atașate" apare doar dacă: (a) avem poze, (b) browser-ul
  // suportă Web Share cu files. Pe desktop Chrome/Edge cu suport — apare;
  // pe Firefox / Chrome Linux — nu apare deloc, fallback transparent.
  const canShareAttachments = hasPhotos && shareSupported === true;

  const copyAll = async () => {
    const text = `Către: ${payload.to.join(", ")}\nCC: ${payload.cc.join(", ")}\nSubiect: ${payload.subject}\n\n${payload.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("all");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(payload.body);
      setCopied("body");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const copyTo = async () => {
    try {
      await navigator.clipboard.writeText(payload.to.join(", ") + (payload.cc.length > 0 ? `, ${payload.cc.join(", ")}` : ""));
      setCopied("to");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  /**
   * Trimite cu pozele atașate REAL — folosește Web Share API.
   * Înainte de share, copiază destinatarii în clipboard ca user să-i lipească
   * în câmpul „Către:" după ce se deschide aplicația de mail (Web Share nu
   * suportă pre-fill pentru câmpul To: separat — limitare de protocol).
   *
   * Adăugăm la începutul body-ului o secțiune „DESTINATARI" cu emailurile,
   * ca dublă siguranță: și dacă userul nu lipește din clipboard, oricum vede
   * destinatarii în corpul mailului și-i poate copia de acolo.
   */
  const sendWithAttachments = async () => {
    if (!hasPhotos || sharing) return;
    setSharing(true);
    setShareToast(null);

    const recipients = [...payload.to, ...payload.cc];
    // Body augmentat cu lista de destinatari proeminentă la început, ca user
    // să o vadă ușor în compositorul de mail dacă paste-ul în „Către" eșuează.
    const augmentedBody = `📋 DESTINATARI (lipește în câmpul „Către:"):
${recipients.join(", ")}

────────────────────────────────────────────

${payload.body}`;

    const result = await shareSesizareWithAttachments({
      imageUrls: input.imagini ?? [],
      subject: payload.subject,
      body: augmentedBody,
      recipients,
    });

    setSharing(false);

    if (result.ok) {
      // Share sheet s-a deschis cu succes. Userul probabil deja vede composer-ul.
      // Afișăm un toast scurt cu reminder-ul de paste, dispare în 6s.
      setShareToast('Pozele sunt atașate. Lipește destinatarii (Ctrl+V) în „Către" și trimite.');
      setTimeout(() => setShareToast(null), 6000);
    } else if (result.reason === "user-cancelled") {
      // User a închis share sheet — nu e eroare, nu afișăm nimic.
    } else if (result.reason === "fetch-failed") {
      setShareToast("N-am putut descărca pozele. Folosește butonul clasic + atașează manual din mail.");
      setTimeout(() => setShareToast(null), 8000);
    } else {
      setShareToast("Browser-ul nu suportă atașarea automată. Folosește butonul clasic.");
      setTimeout(() => setShareToast(null), 8000);
    }
  };

  // On mobile, the primary CTA becomes the OS-default mail app (mailto:).
  // Gmail web link is demoted to secondary because it opens Chrome with a
  // login wall instead of the user's actual email app.
  const isMobile = platform === "mobile";

  return (
    <div className={compact ? "" : "space-y-3"}>
      {/* PRIMARY (Web Share API) — apare doar dacă există poze ȘI browser-ul
          suportă navigator.share({ files }). Pe iOS/Android/Edge/Chrome desktop
          apare; pe Firefox / Chrome Linux nu apare deloc — utilizatorul vede
          doar fluxul clasic de mai jos (mailto cu URL-uri). */}
      {canShareAttachments && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={sendWithAttachments}
            disabled={sharing}
            className="w-full inline-flex items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-xs)] bg-gradient-to-br from-[var(--color-primary)] to-emerald-700 text-white font-semibold hover:brightness-110 shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed"
            title='Deschide aplicația ta de email cu pozele DEJA atașate ca fișiere reale. Destinatarii sunt copiați în clipboard — îi lipești în câmpul „Către:".'
          >
            {sharing ? (
              <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip size={18} aria-hidden="true" />
            )}
            {sharing
              ? "Se pregătesc pozele..."
              : `Trimite cu pozele atașate (${input.imagini?.length ?? 0})`}
          </button>
          <button
            type="button"
            onClick={() => setShowShareHint((v) => !v)}
            className="w-full text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] inline-flex items-center justify-center gap-1 transition-colors"
            aria-expanded={showShareHint}
          >
            <Info size={11} aria-hidden="true" />
            {showShareHint ? "Ascunde explicația" : "Cum funcționează — explicație în 3 pași"}
          </button>
          {showShareHint && (
            <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-[var(--radius-xs)] p-3 text-[11px] leading-relaxed text-[var(--color-text)] space-y-1.5">
              <p>
                <strong>1.</strong> Apesi butonul → se deschide share-ul telefonului/PC-ului
                cu lista de aplicații (Mail, Gmail, Outlook etc.).
              </p>
              <p>
                <strong>2.</strong> Alegi aplicația de mail → composer-ul apare cu pozele
                <strong> deja atașate ca fișiere</strong> + subiect + textul formal.
              </p>
              <p>
                <strong>3.</strong> Câmpul „Către:" e gol — apesi <kbd className="px-1 py-0.5 bg-[var(--color-surface-2)] rounded font-mono text-[10px]">Ctrl+V</kbd> /
                long-press paste (destinatarii sunt deja copiați în clipboard) și dai trimite.
                Asta e singurul pas manual.
              </p>
              <p className="text-[var(--color-text-muted)] pt-1">
                De ce așa? Standardul web (RFC 6068) nu permite ca un site să
                pre-completeze și destinatarii ȘI să atașeze fișiere în același timp.
                Trebuie să alegem una. Tu vrei pozele atașate ca dovezi reale,
                nu link-uri — așa că destinatarii merg via clipboard.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Toast efemer — feedback după share. Dispare automat. */}
      {shareToast && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/40 rounded-[var(--radius-xs)] p-3 text-xs flex items-start gap-2"
        >
          <Paperclip size={13} className="text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{shareToast}</span>
          <button
            type="button"
            onClick={() => setShareToast(null)}
            className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            aria-label="Închide notificarea"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Separator semantic când avem și buton Web Share + clasic */}
      {canShareAttachments && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            sau metoda clasică (poze ca link-uri în text)
          </span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
      )}

      {/* Big primary buttons — mobile prefers OS default mail app */}
      <div className={isMobile ? "grid gap-2" : "grid sm:grid-cols-2 gap-2"}>
        {isMobile ? (
          <a
            href={buildMailtoLink(input)}
            className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            title="Se deschide în aplicația ta de email (Gmail / iOS Mail / Outlook — orice ai setat ca implicit)"
          >
            <Smartphone size={18} aria-hidden="true" />
            Deschide în aplicația de Email
          </a>
        ) : (
          <>
            <a
              href={buildGmailLink(input)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              <Mail size={18} aria-hidden="true" />
              Deschide în Gmail
              <ExternalLink size={12} className="opacity-70" aria-hidden="true" />
            </a>
            <a
              href={buildOutlookLink(input)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-xs)] bg-[#0078d4] text-white font-semibold hover:brightness-110 shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0078d4]"
            >
              <Mail size={18} aria-hidden="true" />
              Deschide în Outlook
              <ExternalLink size={12} className="opacity-70" aria-hidden="true" />
            </a>
          </>
        )}
      </div>

      {/* Secondary row — alternative clients + copy fallback.
          On mobile we still show Gmail/Outlook web for users without a
          mail app (or who prefer the web) but as smaller secondary. */}
      <div className={isMobile ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
        {isMobile && (
          <a
            href={buildGmailLink(input)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors"
            title="Gmail web (browser) — folosește dacă nu ai aplicația"
          >
            Gmail web
          </a>
        )}
        {!isMobile && (
          <a
            href={buildYahooLink(input)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors"
          >
            Yahoo
          </a>
        )}
        {!isMobile && (
          <a
            href={buildMailtoLink(input)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors"
            title="Folosește aplicația ta de email nativă"
          >
            Mail nativ
          </a>
        )}
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {copied === "all" ? <Check size={12} className="text-emerald-600" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          {copied === "all" ? "Copiat în clipboard" : "Copiază emailul"}
        </button>
      </div>

      {isMobile && (
        <p className="text-[11px] text-[var(--color-text-muted)] flex items-start gap-1.5 px-1">
          <Smartphone size={11} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Apasă <strong>Deschide în aplicația de Email</strong> — emailul se completează
            automat în aplicația ta (Gmail / iOS Mail / Outlook). Dacă nu ai o aplicație
            setată ca implicită, folosește <strong>Gmail web</strong> sau copiază emailul.
          </span>
        </p>
      )}

      {!compact && (
        <details className="bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-3 text-xs">
          <summary className="font-medium cursor-pointer select-none">
            Trimit manual din alt client de email
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Către
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block p-2 rounded bg-[var(--color-surface)] font-mono text-[10px] break-all">
                  {payload.to.join(", ")}
                  {payload.cc.length > 0 && `, ${payload.cc.join(", ")}`}
                </code>
                <button
                  type="button"
                  onClick={copyTo}
                  className="h-8 px-2 rounded bg-[var(--color-surface)] text-[10px] font-medium hover:bg-[var(--color-border)]"
                >
                  {copied === "to" ? "✓ Copiat" : "Copiază"}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Subiect
              </p>
              <code className="block p-2 rounded bg-[var(--color-surface)] font-mono text-[10px] break-all">
                {payload.subject}
              </code>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                  Corpul emailului
                </p>
                <button
                  type="button"
                  onClick={copyBody}
                  className="h-7 px-2 rounded bg-[var(--color-surface)] text-[10px] font-medium hover:bg-[var(--color-border)]"
                >
                  {copied === "body" ? "✓ Copiat" : "Copiază textul"}
                </button>
              </div>
              <pre className="p-2 rounded bg-[var(--color-surface)] text-[10px] whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                {payload.body}
              </pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
