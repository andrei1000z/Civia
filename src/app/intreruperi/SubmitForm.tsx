"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Check, Image as ImgIcon, X } from "lucide-react";
import { trackFunnelStep } from "@/components/analytics/CiviaTracker";
import { Button } from "@/components/ui/Button";

export function SubmitForm() {
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honey, setHoney] = useState("");
  const startFiredRef = useRef(false);

  // 2026-05-25 #13 — funnel intrerupere-submit, step „start" la mount form.
  useEffect(() => {
    if (startFiredRef.current) return;
    startFiredRef.current = true;
    trackFunnelStep("intrerupere-submit", "start");
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Imaginea e prea mare (max 5MB)");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare upload");
      setImageUrl(j.data?.urls?.[0] ?? null);
      // #13 funnel step: photo-uploaded
      trackFunnelStep("intrerupere-submit", "photo-uploaded");
    } catch (e) {
      trackFunnelStep("intrerupere-submit", "photo-fail");
      setError(e instanceof Error ? e.message : "Eroare upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // #13 — submit-clicked înainte de validare
    trackFunnelStep("intrerupere-submit", "submit-clicked", {
      textLen: text.trim().length,
      hasPhoto: imageUrl ? 1 : 0,
      hasEmail: email.trim() ? 1 : 0,
    });
    if (text.trim().length < 20) {
      trackFunnelStep("intrerupere-submit", "validation-failed");
      setError("Scrie minim 20 de caractere despre întrerupere.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/intreruperi/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          image_url: imageUrl ?? undefined,
          email: email.trim() || undefined,
          _honey: honey,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        trackFunnelStep("intrerupere-submit", "error");
        throw new Error(j.error || "Eroare trimitere");
      }
      trackFunnelStep("intrerupere-submit", "submitted", { hasPhoto: imageUrl ? 1 : 0 });
      setSubmitted(true);
      setText("");
      setEmail("");
      setImageUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare trimitere");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-[var(--radius-md)] p-6 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3">
          <Check size={24} aria-hidden="true" />
        </div>
        <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold mb-1">
          Mulțumim!
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Submisia ta a ajuns la moderare. Un admin o verifică și, dacă e
          relevantă, o adaugă în catalog.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-xs text-[var(--color-primary)] hover:underline font-medium"
        >
          Raportează încă o întrerupere →
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 space-y-4"
    >
      <div>
        <label htmlFor="isub-text" className="block text-sm font-semibold mb-2">
          Ce ai observat? <span className="text-red-500">*</span>
        </label>
        <textarea
          id="isub-text"
          required
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          placeholder="Ex: „Apa oprită din 08:00 astăzi pe Calea Victoriei 40-60. Anunțul e afișat în scara blocului pe gresie. Lucrări până mâine 18:00 conform hârtiei.”"
          rows={5}
          aria-describedby="isub-text-hint"
          aria-invalid={text.length > 0 && text.trim().length < 20}
          className="w-full px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] resize-y min-h-[110px]"
        />
        <p
          id="isub-text-hint"
          className={`text-[11px] mt-1 tabular-nums ${
            text.length > 0 && text.trim().length < 20
              ? "text-amber-600 dark:text-amber-400"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {text.length}/2000 · minim 20 caractere
          {text.length > 0 && text.trim().length < 20 && (
            <> · mai ai {20 - text.trim().length} de scris</>
          )}
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">
          Fotografie dovadă <span className="font-normal text-[var(--color-text-muted)]">(opțional)</span>
        </label>
        {imageUrl ? (
          <div className="flex items-center gap-3 p-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)]">
            <ImgIcon size={18} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
            <span className="flex-1 text-xs truncate text-[var(--color-text-muted)]">
              Imagine încărcată ✓
            </span>
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="w-7 h-7 rounded-full bg-[var(--color-surface)] hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Elimină imaginea"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label
            className={`flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] border-2 border-dashed cursor-pointer text-sm transition-colors ${
              uploading
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Se încarcă...
              </>
            ) : (
              <>
                <ImgIcon size={14} aria-hidden="true" />
                Adaugă o poză (anunț, stradă, lucrări)
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div>
        <label htmlFor="isub-email" className="block text-sm font-semibold mb-2">
          Email <span className="font-normal text-[var(--color-text-muted)]">(opțional)</span>
        </label>
        <input
          id="isub-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nume@exemplu.ro"
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
          Doar dacă vrei să te contactăm pentru detalii / confirmări.
        </p>
      </div>

      {/* honeypot — ascuns vizual */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honey}
        onChange={(e) => setHoney(e.target.value)}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
      />

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-[var(--radius-xs)] px-3 py-2"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={submitting || text.trim().length < 20}
        aria-busy={submitting}
        loading={submitting}
        leftIcon={<Send size={14} aria-hidden="true" />}
        className="w-full"
      >
        {submitting ? "Se trimite..." : "Trimite raport"}
      </Button>
    </form>
  );
}
