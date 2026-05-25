"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Megaphone, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { trackPetitieSign, trackAuthModalOpen } from "@/components/analytics/CiviaTracker";

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

  if (!isActive) {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-full)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-sm font-medium cursor-not-allowed"
      >
        Petiție încheiată
      </button>
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
      <button
        type="button"
        onClick={() => {
          trackAuthModalOpen("petitie-sign");
          openAuthModal();
        }}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-full)] bg-purple-600 hover:bg-purple-700 active:scale-[0.97] text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
      >
        <LogIn size={16} aria-hidden="true" />
        Conectează-te ca să semnezi
      </button>
    );
  }

  const sign = async () => {
    setSigning(true);
    try {
      const res = await fetch(`/api/petitii/${petitieId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare la semnare");
      setSigned(true);
      trackPetitieSign(petitieSlug);
      toast("Mulțumim! Semnătura ta a fost înregistrată.", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-3">
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
      <button
        type="button"
        onClick={sign}
        disabled={signing}
        aria-busy={signing}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-full)] bg-purple-600 hover:bg-purple-700 active:scale-[0.97] text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
      >
        {signing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Megaphone size={16} aria-hidden="true" />}
        Semnează petiția
      </button>
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
