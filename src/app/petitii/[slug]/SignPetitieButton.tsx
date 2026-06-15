"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Megaphone, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import {
  trackPetitieSign,
  trackAuthModalOpen,
  trackFunnelStep,
} from "@/components/analytics/CiviaTracker";

interface Props {
  petitieId: string;
  petitieSlug: string;
  isActive: boolean;
  isLoggedIn: boolean;
  alreadySigned: boolean;
}

export function SignPetitieButton({ petitieId, petitieSlug, isActive, isLoggedIn, alreadySigned }: Props) {
  const { openAuthModal } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(alreadySigned);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const viewFiredRef = useRef(false);
  const visibleFiredRef = useRef(false);

  // 2026-05-25 #9 — funnel petitie-sign complet 6 pași.
  // Step „view" la mount (component renderează ⇒ user vede butonul).
  useEffect(() => {
    if (viewFiredRef.current || alreadySigned || !isActive) return;
    viewFiredRef.current = true;
    trackFunnelStep("petitie-sign", "view", { slug: petitieSlug });
  }, [petitieSlug, alreadySigned, isActive]);

  // Step „button-visible" via IntersectionObserver — userul a scrollat
  // suficient să vadă butonul. Critical pentru funnel: cât % din userii
  // care intră pe pagina petiției ajung măcar să vadă CTA.
  useEffect(() => {
    if (visibleFiredRef.current || alreadySigned || !isActive) return;
    if (!buttonRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !visibleFiredRef.current) {
            visibleFiredRef.current = true;
            trackFunnelStep("petitie-sign", "button-visible", { slug: petitieSlug });
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(buttonRef.current);
    return () => io.disconnect();
  }, [petitieSlug, alreadySigned, isActive]);

  if (!isActive) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="lg"
        shape="pill"
        disabled
        className="w-full"
      >
        Petiție încheiată
      </Button>
    );
  }

  if (signed) {
    return (
      <div className="flex flex-col items-center gap-2 p-3 rounded-[var(--radius-xs)] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
        <Check size={20} aria-hidden="true" />
        Mulțumim! Ai semnat deja această petiție.
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div ref={buttonRef}>
        <Button
          type="button"
          variant="petition"
          size="lg"
          shape="pill"
          leftIcon={<LogIn size={16} aria-hidden="true" />}
          onClick={() => {
            // 2026-05-25 #8 — auth-required step DISTINCT, killer #1
            // în funnel (research: drop-off după AI draft).
            trackFunnelStep("petitie-sign", "auth-required", { slug: petitieSlug });
            trackAuthModalOpen("petitie-sign");
            openAuthModal();
          }}
          className="w-full"
        >
          Conectează-te ca să semnezi
        </Button>
      </div>
    );
  }

  const sign = async () => {
    // 2026-05-25 #9 — sign-clicked înainte de fetch (timing pentru latency).
    trackFunnelStep("petitie-sign", "sign-clicked", {
      slug: petitieSlug,
      hasComment: comment.trim() ? 1 : 0,
    });
    setSigning(true);
    try {
      const res = await fetch(`/api/petitii/${petitieId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        trackFunnelStep("petitie-sign", "error", { slug: petitieSlug });
        throw new Error(json.error || "Eroare la semnare");
      }
      setSigned(true);
      trackPetitieSign(petitieSlug);
      trackFunnelStep("petitie-sign", "success", { slug: petitieSlug });
      toast("Mulțumim! Semnătura ta a fost înregistrată.", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div ref={buttonRef} className="space-y-3">
      {showComment && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 200))}
          rows={3}
          maxLength={200}
          placeholder="Scrie-mi de ce semnezi (opțional, max 200 caractere)..."
          autoCapitalize="sentences"
          spellCheck
          className="w-full p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        />
      )}
      <Button
        type="button"
        variant="petition"
        size="lg"
        shape="pill"
        loading={signing}
        leftIcon={<Megaphone size={16} aria-hidden="true" />}
        onClick={sign}
        aria-busy={signing}
        className="w-full"
      >
        Semnează acum
      </Button>
      {!showComment && (
        <button
          type="button"
          onClick={() => setShowComment(true)}
          className="block w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-center"
        >
          + Adaugă un comentariu (opțional)
        </button>
      )}
    </div>
  );
}
