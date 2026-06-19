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
import { RelatedPetitiiCard } from "@/components/sesizari/RelatedPetitiiCard";
import { Button } from "@/components/ui/Button";
import { SuccessShareSection } from "@/components/sesizari/SuccessShareSection";

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

      <SuccessShareSection code={code} title={emailInput.titlu} className="mt-8" />

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
