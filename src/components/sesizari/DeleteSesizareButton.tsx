"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";

interface Props {
  code: string;
  /**
   * Pre-computed server-side — avoids leaking author_email into
   * every visitor's HTML payload just to gate this button.
   */
  isAuthor: boolean;
}

export function DeleteSesizareButton({ code, isAuthor }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Escape closes confirm + lock body scroll while modal is open.
  // (We don't allow Escape during delete in flight — accidental cancel mid-call
  // would leave the user wondering whether the delete went through.)
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setConfirm(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [confirm, deleting]);

  // Only show to author
  if (!user || !isAuthor) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sesizari/${code}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare");
      toast("Sesizarea a fost ștearsă", "success");
      router.push("/sesizari");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare la ștergere", "error");
      setDeleting(false);
      setConfirm(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={() => setConfirm(true)}
        leftIcon={<Trash2 size={16} aria-hidden="true" />}
        title="Șterge sesizarea"
      >
        Șterge
      </Button>

      {confirm && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto overscroll-contain animate-fade-in"
          onClick={() => !deleting && setConfirm(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sesizare-title"
            className="w-full max-w-sm bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] my-8 max-h-[calc(100dvh-4rem)] overflow-y-auto animate-modal-pop"
          >
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-5 relative">
              {!deleting && (
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Închide modalul de ștergere"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
              <div className="flex items-start gap-3">
                <AlertTriangle size={24} className="shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h3 id="delete-sesizare-title" className="font-[family-name:var(--font-sora)] text-lg font-bold">
                    Șterge sesizarea
                  </h3>
                  <p className="text-sm text-white/90 mt-1">
                    Această acțiune nu poate fi anulată.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[var(--color-text)]">
                Sesizarea, comentariile și toate datele asociate vor fi șterse definitiv.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirm(false)}
                  disabled={deleting}
                  className="flex-1"
                >
                  Anulează
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={handleDelete}
                  disabled={deleting}
                  loading={deleting}
                  leftIcon={<Trash2 size={14} aria-hidden="true" />}
                  className="flex-1"
                >
                  Da, șterge
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
