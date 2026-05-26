"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  X,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Eye,
  Mail,
  Building2,
  FileText,
  Paperclip,
  Pencil,
} from "lucide-react";
import { getRecipientsLabel } from "@/lib/sesizari/mailto";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { trackSesizareCosign } from "@/components/analytics/CiviaTracker";

interface Props {
  tip: string;
  titlu: string;
  locatie: string;
  sector?: string | null;
  /** 2026-05-26 — cod județ pentru routing autorități corect în preview.
   *  Dacă lipsește, preview-ul fallback la detectCountyFromLocatie. */
  county?: string | null;
  descriere: string;
  formal_text?: string | null;
  imagini?: string[];
  code: string;
  variant?: "primary" | "outline";
}

const STORAGE_KEY = "civic_user_data";

interface UserData {
  name: string;
  address: string;
  email: string;
}

/** Etichetă + valoare pentru un câmp în previzualizarea emailului
 *  (Către / Cc / Subiect). Aliniat ca un client real de email. */
function PreviewField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[68px_1fr] sm:grid-cols-[88px_1fr] gap-3 items-start">
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--color-text-muted)] pt-1.5">
        {icon}
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * „Trimite și tu" — Co-sign + send REAL prin sesizari@civia.ro (Resend).
 *
 * 5/22/2026 — Refactor complet la cererea user-ului. Înainte:
 *   • Modal cu form
 *   • EmailChoicePanel cu Gmail/Outlook/Mailto/Copy
 *   • Pe mobil: link-uri descărcare poze manual + mailto:
 *   • User trebuia să atașeze pozele manual în Gmail/Mail/etc
 *
 * Acum:
 *   1. User apasă „Trimite și tu" → modal cu nume + adresa
 *   2. Apasă „Trimite" → POST /api/sesizari/[code]/cosign-send
 *   3. Backend trimite REAL via Resend de la sesizari@civia.ro
 *      cu identitatea persoanei care trimite + atașează pozele AUTOMAT
 *   4. Success → arată confirmation + closes modal
 *
 * Zero mailto, zero descărcat poze, zero browser email apps.
 */
export function SignSesizareButton({
  tip,
  titlu,
  locatie,
  sector,
  county,
  code,
  variant = "primary",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"form" | "sending" | "sent" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  // Lazy initializer — reads localStorage sync on first render
  const [data, setData] = useState<UserData>(() => {
    if (typeof window === "undefined") return { name: "", address: "", email: "" };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as UserData;
      } catch {
        /* ignore corrupt */
      }
    }
    return { name: "", address: "", email: "" };
  });
  const [remember, setRemember] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Honeypot — bots completează automat, respinge silent
  const [honey, setHoney] = useState("");
  // 2026-05-26 — Preview pe demand. Fetch real email text de pe server
  // (cu county-fallback rezolvat + nume/adresă substituite în formal_text).
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    recipients: string;
    recipientsLabel: string;
    to: { name: string; email: string }[];
    cc: { name: string; email: string }[];
    subject: string;
    body: string;
    hasPhotos: boolean;
    photoCount: number;
  } | null>(null);

  // Escape closes + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
     
  }, [open]);

  // Auto-fill din profile dacă user logat
  useEffect(() => {
    if (!user || profileLoaded) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setData((prev) => ({
            name: j.data.full_name || j.data.display_name || prev.name,
            address: j.data.address || prev.address,
            email: j.data.email || prev.email,
          }));
        }
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, [user, profileLoaded]);

  const canSubmit = data.name.trim().length >= 2 && data.address.trim().length >= 3;

  async function handlePreview() {
    if (!canSubmit || previewLoading) return;
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams({
        nume: data.name.trim(),
        adresa: data.address.trim(),
      });
      const res = await fetch(`/api/sesizari/${code}/cosign-preview?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nu am putut genera previzualizarea");
      setPreviewData(json.data);
      setShowPreview(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Eroare previzualizare");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (remember && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    setState("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/sesizari/${code}/cosign-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nume: data.name.trim(),
          adresa: data.address.trim(),
          email: data.email.trim() || null,
          _honey: honey,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setErrorMsg(json.error ?? "Email-ul nu a putut fi trimis.");
        return;
      }
      setState("sent");
      trackSesizareCosign();
      // Notifica CosignersBadge să refresh
      window.dispatchEvent(new CustomEvent("civia:cosign-added"));
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Eroare rețea");
    }
  }

  function handleClose() {
    setOpen(false);
    // Reset state după 300ms (timpul animației de fade-out)
    setTimeout(() => {
      setState("form");
      setErrorMsg("");
    }, 300);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-xs)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
          variant === "primary"
            ? "h-11 px-5 text-sm bg-[var(--color-secondary)] text-white hover:brightness-110 shadow-md"
            : "h-9 px-3 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]",
        )}
        title="Trimite același email la autorități cu identitatea ta — direct prin Civia."
      >
        <UserPlus size={variant === "primary" ? 16 : 13} aria-hidden="true" />
        Trimite și tu
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={handleClose}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-modal-title"
            className="w-full max-w-lg bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] my-8 overflow-hidden animate-modal-pop"
          >
            <header className="bg-gradient-to-r from-[var(--color-secondary)] to-emerald-700 text-white p-5 relative">
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Închide"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <h3
                id="sign-modal-title"
                className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1"
              >
                {state === "sent" ? "Email trimis ✓" : "Trimite și tu această sesizare"}
              </h3>
              <p className="text-sm text-white/85">
                {state === "sent"
                  ? "Identitatea ta a fost adăugată la sesizare și emailul a plecat la autorități."
                  : "Completează datele tale. Emailul pleacă DIRECT de la sesizari@civia.ro cu pozele atașate automat."}
              </p>
            </header>

            {state === "sent" ? (
              <div className="p-6 space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 grid place-items-center mx-auto">
                  <CheckCircle2 size={32} aria-hidden="true" />
                </div>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  Cu cât suntem mai mulți, cu atât autoritățile răspund mai repede.
                  Mulțumim pentru implicare! 🙌
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                >
                  Închide
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4" autoComplete="on">
                {/* Honeypot — invisible to humans, attractive to bots. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honey}
                  onChange={(e) => setHoney(e.target.value)}
                  aria-hidden="true"
                  className="absolute opacity-0 pointer-events-none -z-10"
                  style={{ position: "absolute", left: "-9999px" }}
                />
                <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-muted)]">
                  <p className="font-semibold text-[var(--color-text)] mb-1">Despre sesizare:</p>
                  <p className="line-clamp-2">{titlu}</p>
                  <p className="mt-2">
                    <strong>Se trimite la:</strong>{" "}
                    {getRecipientsLabel(tip, sector, locatie, undefined, county)}
                  </p>
                </div>

                <div>
                  <label htmlFor="cosign-name" className="block text-sm font-medium mb-1.5">
                    Numele tău <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cosign-name"
                    type="text"
                    autoComplete="name"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="Ex: Ion Popescu"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    required
                    disabled={state === "sending"}
                  />
                </div>

                <div>
                  <label htmlFor="cosign-address" className="block text-sm font-medium mb-1.5">
                    Adresa ta (domiciliu) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cosign-address"
                    type="text"
                    autoComplete="street-address"
                    value={data.address}
                    onChange={(e) => setData({ ...data, address: e.target.value })}
                    placeholder="Ex: Str. Exemplu 12, Sector 3, București"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    required
                    disabled={state === "sending"}
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                    Necesar pentru identificare oficială în emailul către primărie (OG 27/2002 art. 12). Pe pagina publică numele și adresa NU apar.
                  </p>
                </div>

                <div>
                  <label htmlFor="cosign-email" className="block text-sm font-medium mb-1.5">
                    Email <span className="text-[var(--color-text-muted)] font-normal">(opțional, primești copie)</span>
                  </label>
                  <input
                    id="cosign-email"
                    type="email"
                    autoComplete="email"
                    value={data.email}
                    onChange={(e) => setData({ ...data, email: e.target.value })}
                    placeholder="exemplu@email.ro"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    disabled={state === "sending"}
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Ține minte datele în browser (data viitoare nu mai le tastezi)
                  </span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!canSubmit || previewLoading || state === "sending"}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[var(--color-text)] font-semibold border border-[var(--color-border)] hover:bg-[var(--color-border)]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    title="Vezi exact ce email pleacă"
                  >
                    {previewLoading ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">Previzualizare</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || state === "sending"}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
                  >
                    {state === "sending" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        Trimit emailul către autorități...
                      </>
                    ) : (
                      <>
                        Trimite acum
                        <ArrowRight size={16} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>

                {state === "error" && errorMsg && (
                  <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                    {errorMsg}
                  </p>
                )}

                <p className="text-[11px] text-center text-[var(--color-text-muted)] leading-relaxed">
                  📎 Pozele se atașează automat · 🇪🇺 Date stocate în UE · Conform OG 27/2002
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Preview modal — overlayed peste cosign modal când user apasă „Previzualizare".
          Arată EXACT: destinatari (cu county-fallback aplicat), subject, body
          formal_text cu nume + adresa substituite real (compute server-side). */}
      {showPreview && previewData && (
        <div
          className="fixed inset-0 z-[calc(var(--z-modal)+1)] bg-black/60 backdrop-blur-md flex items-start md:items-center justify-center p-2 md:p-4 overflow-y-auto animate-fade-in"
          onClick={() => setShowPreview(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cosign-preview-title"
            className="w-full max-w-3xl bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] overflow-hidden my-4 md:my-8 animate-modal-pop flex flex-col max-h-[calc(100vh-2rem)]"
          >
            {/* Header — gradient cu eyebrow + titlu + close */}
            <header className="relative bg-gradient-to-br from-[var(--color-secondary)] via-emerald-700 to-emerald-800 text-white px-5 md:px-6 py-5">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label="Închide previzualizarea"
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <div className="flex items-start gap-3 pr-12">
                <div className="shrink-0 w-11 h-11 rounded-[var(--radius-xs)] bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Mail size={20} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/75 mb-1">
                    Previzualizare
                  </p>
                  <h3
                    id="cosign-preview-title"
                    className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-bold leading-tight"
                  >
                    Așa pleacă emailul către autorități
                  </h3>
                  <p className="text-xs text-white/80 mt-1 leading-relaxed">
                    De la <span className="font-semibold">sesizari@civia.ro</span> în numele tău · OG 27/2002
                  </p>
                </div>
              </div>
            </header>

            {/* Scroll area */}
            <div className="flex-1 overflow-y-auto">
              {/* Email header fields — From/To/CC/Subject */}
              <div className="px-5 md:px-6 py-4 space-y-3 bg-[var(--color-surface-2)]/40 border-b border-[var(--color-border)]">
                <PreviewField icon={<Building2 size={14} aria-hidden="true" />} label="Către">
                  <p className="font-semibold text-[var(--color-text)] mb-2">
                    {previewData.recipientsLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewData.to.map((r) => (
                      <span
                        key={r.email}
                        className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs"
                        title={`${r.name} <${r.email}>`}
                      >
                        <span className="font-medium text-[var(--color-text)] truncate">{r.name}</span>
                        <span className="text-[var(--color-text-muted)] font-mono text-[10px] truncate hidden sm:inline">
                          {r.email}
                        </span>
                      </span>
                    ))}
                  </div>
                </PreviewField>

                {previewData.cc.length > 0 && (
                  <PreviewField icon={<Mail size={14} aria-hidden="true" />} label="Cc">
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.cc.map((r) => (
                        <span
                          key={r.email}
                          className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs"
                          title={`${r.name} <${r.email}>`}
                        >
                          <span className="font-medium text-[var(--color-text)] truncate">{r.name}</span>
                          <span className="text-[var(--color-text-muted)] font-mono text-[10px] truncate hidden sm:inline">
                            {r.email}
                          </span>
                        </span>
                      ))}
                    </div>
                  </PreviewField>
                )}

                <PreviewField icon={<FileText size={14} aria-hidden="true" />} label="Subiect">
                  <p className="font-semibold text-[var(--color-text)] leading-snug">
                    {previewData.subject}
                  </p>
                </PreviewField>
              </div>

              {/* Email body — rendered ca document */}
              <div className="px-5 md:px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] font-bold mb-2">
                  Mesaj
                </p>
                <div className="rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-inner">
                  <div className="px-4 py-4 md:px-5 md:py-5 max-h-[40vh] md:max-h-[45vh] overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed font-sans text-[var(--color-text)]">
{previewData.body}
                    </pre>
                  </div>
                </div>

                {previewData.hasPhotos && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-xs)] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                    <Paperclip size={14} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      {previewData.photoCount} {previewData.photoCount === 1 ? "poză atașată" : "poze atașate"} automat
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer — back + send */}
            <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/60 px-5 md:px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed text-center sm:text-left">
                🇪🇺 Date stocate în UE · Conform OG 27/2002
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  <Pencil size={14} aria-hidden="true" />
                  Editez datele
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPreview(false);
                    handleSubmit(new Event("submit") as unknown as React.FormEvent);
                  }}
                  disabled={state === "sending"}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
                >
                  Trimite acum
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
