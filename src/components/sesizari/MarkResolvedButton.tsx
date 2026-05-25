"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { trackCustomEvent, trackAuthModalOpen } from "@/components/analytics/CiviaTracker";
import { PhotoUploader } from "./PhotoUploader";

interface Props {
  code: string;
  status: string;
  /**
   * Pre-computed server-side so the author's email doesn't leak
   * into the HTML payload of every visitor. Page.tsx already knows
   * whether the current user owns this sesizare; we just pass the
   * boolean down.
   */
  isAuthor: boolean;
}

export function MarkResolvedButton({ code, status, isAuthor }: Props) {
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes + lock body scroll while modal is open.
  // Hook runs before the early-return below — react-hooks/rules-of-hooks
  // requires hooks to fire in the same order on every render.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (status === "rezolvat") return null;
  // 2026-05-18: doar autorul vede butonul (cetatenii non-author n-au
  // ce face cu el). Pana acum se afisa la toata lumea cu mesaj de eroare.
  if (!isAuthor) return null;

  const canResolve = !!user && isAuthor;

  const handleClick = () => {
    if (!user) {
      trackAuthModalOpen("mark-resolved");
      openAuthModal();
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sesizari/${code}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved_photo_url: photo[0] ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare");
      trackCustomEvent("sesizare-mark-resolved", {
        hasPhoto: photo[0] ? "yes" : "no",
      });
      toast("Sesizare marcată ca rezolvată! 🎉", "success");
      router.refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-emerald-500 text-white text-sm font-medium hover:brightness-110 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <CheckCircle2 size={15} aria-hidden="true" />
        S-a rezolvat — marchează ca rezolvată
      </button>
      {error && !open && (
        <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-modal-title"
            className="w-full max-w-md bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] overflow-hidden animate-modal-pop"
          >
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 relative">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Închide modalul"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <h3 id="resolve-modal-title" className="font-[family-name:var(--font-sora)] text-xl font-bold">
                Confirmi că s-a rezolvat?
              </h3>
              <p className="text-sm text-white/85 mt-1">
                Marchează sesizarea ca rezolvată și, opțional, atașează o poză „după" — alimentează galeria publică de dovezi.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">
                  Poza „după rezolvare" (opțional, dar puternic)
                </label>
                <PhotoUploader urls={photo} onChange={setPhoto} max={1} />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-11 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-sm font-medium hover:bg-[var(--color-border)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-emerald-500 text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-500"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                  Da, a fost rezolvată
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
