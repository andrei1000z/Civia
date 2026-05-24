"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mail, Copy } from "lucide-react";
import {
  buildMailtoLink,
  buildGmailLink,
  buildGmailAndroidIntent,
  buildGmailIosLink,
  type MailtoInput,
} from "@/lib/sesizari/mailto";
import { playSound } from "@/lib/liquid-civic/sound";
import { CivicSprite } from "@/components/liquid-civic/CivicSprite";
import { SendViaCiviaButton } from "@/components/sesizari/SendViaCiviaButton";

/**
 * Success screen post-submit — extras din SesizareForm in fisier separat
 * pentru lazy-loading. ~370 LOC de cod folosit DOAR post-submit (Gmail
 * link builders, mailto auto-open, code copy, viral share buttons,
 * Civic Sprite mascot).
 *
 * Cu lazy import in SesizareForm, aceste 370 LOC nu mai sunt incarcate
 * initial — economie ~12KB minified pe primul page load.
 */
export function SuccessScreen({
  code,
  emailInput,
  onAnother,
  isFirstSesizare = true,
}: {
  code: string;
  emailInput: MailtoInput;
  imaginiCount: number;
  onAnother: () => void;
  /** Daca userul are deja sesizari prior, sprite-ul „prima sesizare"
   *  nu se afiseaza (bug user 5/22/2026). */
  isFirstSesizare?: boolean;
}) {
  const router = useRouter();
  type Platform = "ios" | "android" | "desktop";
  const [platform] = useState<Platform>(() => {
    if (typeof navigator === "undefined") return "desktop";
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  });
  const [autoOpened, setAutoOpened] = useState(false);

  const isMobile = platform === "ios" || platform === "android";

  const mailtoUrl = buildMailtoLink(emailInput);
  const emailAddr = emailInput.author_email?.toLowerCase() ?? "";
  const isGmailAddr =
    emailAddr.endsWith("@gmail.com") || emailAddr.endsWith("@googlemail.com");
  const gmailWebUrl = isGmailAddr ? buildGmailLink(emailInput) : null;
  const gmailAppUrl =
    platform === "android"
      ? buildGmailAndroidIntent(emailInput)
      : platform === "ios"
        ? buildGmailIosLink(emailInput)
        : null;

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    playSound("success");
  }, []);

  // BUG 2026-05-24: anteriorul auto-open mailto făcea ca user-ul să creadă că
  // mailto E FLOW-UL PRIMAR. 45/48 sesizări rămâneau cu sent_via_civia=false
  // pentru că mailto se deschidea fără să apese cineva pe Civia 1-click.
  // Acum: NU mai auto-deschidem nimic — user-ul vede butonul mare verde
  // „Trimite oficial cu Civia" ca prima opțiune. Mailto e fallback opțional.
  // (autoOpened state păstrat pentru afișarea „Re-deschide emailul" la mailto.)

  const [codeCopied, setCodeCopied] = useState(false);
  const copyCode = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      })
      .catch(() => { /* silent */ });
  };

  return (
    <div ref={cardRef} className="max-w-md mx-auto py-8 text-center scroll-mt-4">
      <CivicSprite
        type="first-sesizare"
        persistentKey="first-sesizare"
        enabled={isFirstSesizare}
      />
      <div role="status" aria-live="polite" className="sr-only">
        Sesizare înregistrată cu succes. Cod: {code.split("").join(" ")}
      </div>

      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-2">
        Sesizare înregistrată!
      </h3>
      <p className="text-[var(--color-text-muted)] mb-5 text-sm">
        🚀 <strong>Următorul pas: trimite-o oficial primăriei.</strong>
        <br />
        Apasă butonul verde — Civia o trimite din partea ta.
      </p>

      <SendViaCiviaButton code={code} className="mb-6" />

      <details className="mb-3 text-left">
        <summary className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-2 rounded-[var(--radius-xs)] hover:bg-[var(--color-surface-2)] transition-colors list-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">⚙️</span>
          Vrei să trimiți tu personal din emailul tău? (avansat)
        </summary>
        <div className="mt-3 px-1">

      {platform === "android" && (
        <a
          href={gmailAppUrl!}
          className="inline-flex w-full items-center justify-center gap-2 h-14 px-6 mb-3 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-base font-bold hover:bg-[var(--color-primary-hover)] active:scale-[0.98] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          <Mail size={20} aria-hidden="true" />
          Deschide în aplicația Gmail
        </a>
      )}

      {platform === "ios" && (
        <>
          <a
            href={gmailAppUrl!}
            className="inline-flex w-full items-center justify-center gap-2 h-14 px-6 mb-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-base font-bold hover:bg-[var(--color-primary-hover)] active:scale-[0.98] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            <Mail size={20} aria-hidden="true" />
            Deschide în Gmail
          </a>
          <a
            href={mailtoUrl}
            className="inline-flex w-full items-center justify-center gap-2 h-12 px-4 mb-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Sau deschide în Mail (iOS)
          </a>
        </>
      )}

      {platform === "desktop" && (
        <>
          <a
            href={mailtoUrl}
            className="inline-flex w-full items-center justify-center gap-2 h-14 px-6 mb-3 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-base font-bold hover:bg-[var(--color-primary-hover)] active:scale-[0.98] shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            <Mail size={20} aria-hidden="true" />
            {autoOpened ? "Re-deschide emailul" : "Deschide emailul"}
          </a>
          {gmailWebUrl && (
            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 h-11 px-4 mb-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              Sau deschide în Gmail web →
            </a>
          )}
        </>
      )}

      <p className="text-[11px] text-[var(--color-text-muted)] mb-6 leading-relaxed">
        {platform === "android"
          ? `Se deschide aplicația Gmail cu textul completat. Tu apeși Trimite. Dacă nu ai Gmail instalat, te trimite la aplicația ta default de email.`
          : platform === "ios"
            ? `Apasă Gmail dacă ai aplicația instalată. Altfel apasă Mail (iOS) și se deschide aplicația ta de email default.`
            : `Sau apasă butonul de sus ca să deschizi emailul în aplicația ta.`}
      </p>
        </div>
      </details>

      <p className="text-[var(--color-text-muted)] mb-1 text-xs">Cod unic — salvează-l pentru urmărire:</p>

      <button
        type="button"
        onClick={copyCode}
        className="group inline-flex items-center gap-2 mb-1 px-4 py-2 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary)]/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-label={`Copiază codul ${code}`}
      >
        <span className="font-mono font-bold text-2xl text-[var(--color-primary)] tracking-wide">
          {code}
        </span>
        {codeCopied ? (
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy
            size={16}
            className="text-[var(--color-primary)]/60 group-hover:text-[var(--color-primary)] transition-colors"
            aria-hidden="true"
          />
        )}
      </button>
      <p className="text-[10px] text-[var(--color-text-muted)] mb-6">
        {codeCopied ? "Copiat în clipboard" : "Apasă să-l copiezi"}
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => router.push(`/sesizari/${code}`)}
          className="h-11 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          Vezi sesizarea ta →
        </button>
        <button
          onClick={onAnother}
          className="h-11 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          Altă sesizare
        </button>
      </div>

      <SuccessShareSection code={code} title={emailInput.titlu} />

      <p className="text-[11px] text-[var(--color-text-muted)] mt-6 leading-relaxed">
        Răspunsul vine în max. <strong className="text-[var(--color-text)]">30 de zile</strong> calendaristice (OG 27/2002).
      </p>
    </div>
  );
}

function SuccessShareSection({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://civia.ro/sesizari/${code}`;
  const shareText = title;

  const trackShare = (channel: string) => {
    import("@/components/analytics/CiviaTracker")
      .then(({ trackCustomEvent }) => trackCustomEvent("share", { channel, url, source: "success-screen" }))
      .catch(() => { /* silent */ });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setCopied(true);
      trackShare("clipboard-success");
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;
  const blueskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
      <p className="text-sm font-semibold mb-1 text-[var(--color-text)]">
        Spune-le și prietenilor — 5 secunde
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
        Cu cât mai mulți cetățeni trimit aceeași sesizare, cu atât primăria
        răspunde mai rapid. Distribuie în cartier:
      </p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("whatsapp-success")}
          className="inline-flex flex-col items-center justify-center gap-1 h-16 rounded-[var(--radius-xs)] bg-[#25D366] text-white hover:brightness-110 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
          aria-label="Distribuie pe WhatsApp"
        >
          <span className="text-xl" aria-hidden="true">💬</span>
          <span className="text-[10px] font-medium">WhatsApp</span>
        </a>
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("telegram-success")}
          className="inline-flex flex-col items-center justify-center gap-1 h-16 rounded-[var(--radius-xs)] bg-[#0088cc] text-white hover:brightness-110 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
          aria-label="Distribuie pe Telegram"
        >
          <span className="text-xl" aria-hidden="true">✈️</span>
          <span className="text-[10px] font-medium">Telegram</span>
        </a>
        <a
          href={blueskyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("bluesky-success")}
          className="inline-flex flex-col items-center justify-center gap-1 h-16 rounded-[var(--radius-xs)] bg-[#0085ff] text-white hover:brightness-110 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
          aria-label="Distribuie pe Bluesky"
        >
          <span className="text-xl" aria-hidden="true">🦋</span>
          <span className="text-[10px] font-medium">Bluesky</span>
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("facebook-success")}
          className="inline-flex flex-col items-center justify-center gap-1 h-12 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Distribuie pe Facebook"
        >
          <span className="text-[#1877F2] font-bold" aria-hidden="true">f</span>
          <span className="text-[10px]">Facebook</span>
        </a>
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("twitter-success")}
          className="inline-flex flex-col items-center justify-center gap-1 h-12 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Distribuie pe Twitter/X"
        >
          <span className="font-bold" aria-hidden="true">𝕏</span>
          <span className="text-[10px]">Twitter</span>
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex flex-col items-center justify-center gap-1 h-12 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Copiază link-ul"
        >
          <span aria-hidden="true">{copied ? "✓" : "🔗"}</span>
          <span className="text-[10px]">{copied ? "Copiat!" : "Copiază"}</span>
        </button>
      </div>
    </div>
  );
}
