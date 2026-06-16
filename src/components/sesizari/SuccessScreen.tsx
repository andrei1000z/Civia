"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  type MailtoInput,
} from "@/lib/sesizari/mailto";
import { playSound } from "@/lib/liquid-civic/sound";
import { CivicSprite } from "@/components/liquid-civic/CivicSprite";
import { useAuth } from "@/components/auth/AuthProvider";
import { SendViaCiviaButton } from "@/components/sesizari/SendViaCiviaButton";
import { PushPermissionButton } from "@/components/notifications/PushPermissionButton";
import { withRef } from "@/lib/referral/client";
import { RelatedPetitiiCard } from "@/components/sesizari/RelatedPetitiiCard";
import { Button } from "@/components/ui/Button";

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
  const { user } = useAuth();

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    playSound("success");
  }, []);

  // 2026-05-28 — Auto-trigger send pe mount pentru TOATĂ lumea (logați
  // + anonimi). Backend accept anonimi dacă sesizarea e <24h vechime.
  const [autoSendStatus, setAutoSendStatus] = useState<"idle" | "sending" | "sent" | "error" | "needs-identity">("sending");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sesizari/${code}/send-via-civia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (cancelled) return;
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setAutoSendStatus("sent");
          playSound("success");
        } else if (res.status === 409 && json.already) {
          setAutoSendStatus("sent");
        } else if (res.status === 400 && json.needs_identity) {
          setAutoSendStatus("needs-identity");
        } else {
          setAutoSendStatus("error");
        }
      } catch {
        if (!cancelled) setAutoSendStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, code]);
  void emailInput; // keep param for backward compat

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

      {/* 2026-05-27 — UI simplificat per cerere user.
          Auto-send pe mount (pentru utilizatori logați). Anonimii văd
          SendViaCiviaButton cu CTA „Login + trimite". Restul (cod unic,
          mailto fallback, Gmail deep-links) scos. */}
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        {autoSendStatus === "sending" ? (
          <Loader2 size={28} className="text-emerald-600 dark:text-emerald-400 animate-spin" />
        ) : (
          <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" />
        )}
      </div>

      <h3 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">
        {autoSendStatus === "sending"
          ? "Trimitem la primărie..."
          : autoSendStatus === "sent"
          ? "Trimisă cu succes!"
          : "Sesizare înregistrată"}
      </h3>
      <p className="text-[var(--color-text-muted)] mb-6 text-sm">
        Cod sesizare: <strong className="font-mono text-[var(--color-text)]">{code}</strong>
      </p>

      {/* Anonim → arată CTA login pentru a putea trimite. Auto-send rulează
          DOAR pentru utilizatori logați (au nume + adresă în profile). */}
      {!user && <SendViaCiviaButton code={code} className="mb-6" />}

      {autoSendStatus === "error" && (
        <SendViaCiviaButton code={code} className="mb-6" />
      )}

      {autoSendStatus === "needs-identity" && (
        <SendViaCiviaButton code={code} className="mb-6" />
      )}

      {/* roadmap F0 — push timing: prompt-ul de notificări apare la momentul
          potrivit (după trimitere reușită), cu copy legat de valoare. Se ascunde
          singur pentru anonimi/browsere nesuportate. */}
      {autoSendStatus === "sent" && (
        <div className="mb-6 flex justify-center">
          <PushPermissionButton context="🔔 Te anunțăm când primăria răspunde" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push(`/sesizari/${code}`)}
          className="w-full"
        >
          Vezi sesizarea
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={onAnother}
          className="w-full"
        >
          Altă sesizare
        </Button>
      </div>

      <SuccessShareSection code={code} title={emailInput.titlu} />

      {/* Chaining sesizare→petiție (Faza 1) — a doua acțiune la intenție maximă. */}
      <RelatedPetitiiCard
        tip={emailInput.tip}
        locatie={emailInput.locatie}
        sector={emailInput.sector}
      />

      <p className="text-[11px] text-[var(--color-text-muted)] mt-6 leading-relaxed">
        Răspunsul vine în max. <strong className="text-[var(--color-text)]">30 de zile</strong> calendaristice (OG 27/2002).
      </p>
    </div>
  );
}

function SuccessShareSection({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // Referral (Faza 1) — atașăm ?ref={codul meu} pe link-ul partajat după mount
  // (cookie civia_rc, citit client-side). Anonim → fără cod, url neschimbat.
  const baseUrl = `https://civia.ro/sesizari/${code}`;
  const [url, setUrl] = useState(baseUrl);
  useEffect(() => {
    setUrl(withRef(baseUrl));
  }, [baseUrl]);
  // Mesaj „acțiune" — îndeamnă alți cetățeni să trimită și ei (viralitate),
  // nu doar titlul sec. Reddit folosește titlul separat (vezi redditUrl).
  const shareText = `Am trimis o sesizare pe Civia: „${title}". Trimite și tu — 90 de secunde și pui presiune pe primărie să rezolve 👇`;

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
  // Reddit — excelent pentru cauze civice (r/Romania, r/Bucuresti, r/{oras}).
  // Title = titlul sesizării (headline), url = link-ul Civia.
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;

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
      <div className="grid grid-cols-4 gap-2">
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
        <a
          href={redditUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare("reddit-success")}
          className="inline-flex flex-col items-center justify-center gap-1 h-12 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Distribuie pe Reddit"
        >
          <span className="text-[#FF4500] font-bold" aria-hidden="true">r/</span>
          <span className="text-[10px]">Reddit</span>
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
