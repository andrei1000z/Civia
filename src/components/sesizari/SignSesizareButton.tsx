"use client";

import { useState, useEffect } from "react";
import { UserPlus, X, AlertCircle, ArrowRight, Mail, Download, Paperclip } from "lucide-react";
import { getRecipientsLabel, buildMailtoLink } from "@/lib/sesizari/mailto";
import { extractLocality } from "@/lib/sesizari/extract-locality";
import { EmailChoicePanel } from "./EmailChoicePanel";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { downloadImageAsJpeg } from "@/lib/image-download";

interface Props {
  tip: string;
  titlu: string;
  locatie: string;
  sector?: string | null;
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

export function SignSesizareButton({
  tip,
  titlu,
  locatie,
  sector,
  descriere,
  formal_text,
  imagini,
  code,
  variant = "primary",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "send">("form");
  // Mobile detection — touch + narrow viewport. Default desktop pe SSR
  // ca să avem hidratare consistentă; flip pe mobil post-mount.
  // De ce contează: pe mobil sărim peste EmailChoicePanel (care arată
  // 4-5 opțiuni Gmail/Outlook/Yahoo/etc) și mergem direct cu mailto:
  // → se deschide aplicația de email defaut (Gmail, iOS Mail, Outlook).
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const detect = () => {
      const touch = window.matchMedia?.("(pointer: coarse)").matches;
      const narrow = window.innerWidth < 768;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobile(touch && narrow);
    };
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);
  // Lazy initializer — reads localStorage sync on first render, no useEffect needed
  const [data, setData] = useState<UserData>(() => {
    if (typeof window === "undefined") return { name: "", address: "", email: "" };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as UserData;
      } catch {
        // ignore corrupt
      }
    }
    return { name: "", address: "", email: "" };
  });
  const [remember, setRemember] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Escape closes + lock body scroll while modal is open.
  // Inline the close logic so the effect has stable deps (`[open]`)
  // instead of depending on a function recreated every render.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setTimeout(() => setStep("form"), 300);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Auto-fill from user profile when logged in (overrides localStorage if profile has data)
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

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name || !data.address) return;
    if (remember && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    setStep("send");
    // Record the IDENTIFIED co-sign on the server. Persistă DOAR numele
    // + (optional) email + localitatea derivata in `sesizare_cosigners`.
    //
    // PRIVACY (bug fix 5/19/2026): inainte trimiteam `city: data.address`
    // = adresa de domiciliu COMPLETA (ex: „Strada Novaci 12, Sector 5")
    // care se persista in DB si se afisa public in CosignersBadge.
    // Acum extragem doar localitatea/sectorul din adresa (ex: „Sector 5"
    // sau „București") + opional, nimic daca nu putem distinge.
    fetch(`/api/sesizari/${code}/cosign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email || null,
        city: extractLocality(data.address),
      }),
    }).catch(() => { /* silent */ });
  };

  const canContinue = data.name.length >= 2 && data.address.length >= 3;

  const emailInput = {
    tip,
    titlu,
    locatie,
    sector,
    descriere,
    formal_text,
    author_name: data.name,
    author_email: data.email || null,
    author_address: data.address,
    imagini,
    code,
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setStep("form"), 300);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-xs)] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
          variant === "primary"
            ? "h-11 px-5 text-sm bg-[var(--color-secondary)] text-white hover:brightness-110 shadow-md"
            : "h-9 px-3 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
        )}
        title="Trimiți același email la autorități, cu numele tău — dă mai multă greutate sesizării"
      >
        <UserPlus size={variant === "primary" ? 16 : 13} aria-hidden="true" />
        {variant === "primary" ? "Trimite și tu" : "Trimite și tu"}
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
                aria-label="Închide modalul de co-semnare"
              >
                <X size={16} aria-hidden="true" />
              </button>
              <h3 id="sign-modal-title" className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">
                {step === "form" ? "Trimite și tu această sesizare" : "Alege cum trimiți emailul"}
              </h3>
              <p className="text-sm text-white/85">
                {step === "form"
                  ? "Trimiți și tu același email la autorități, cu numele tău. Multiple semnături = prioritate mare."
                  : "Se deschide în tab nou, ajunge la emailul tău complet pregătit. Tu apeși „Trimite”."}
              </p>
            </header>

            {step === "form" ? (
              <form onSubmit={handleContinue} className="p-5 space-y-4">
                <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-muted)]">
                  <p className="font-semibold text-[var(--color-text)] mb-1">Despre sesizare:</p>
                  <p className="line-clamp-2">{titlu}</p>
                  <p className="mt-2">
                    <strong>Se trimite la:</strong> {getRecipientsLabel(tip, sector)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Numele tău <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="Ex: Ion Popescu"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Adresa ta (domiciliu) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="street-address"
                    value={data.address}
                    onChange={(e) => setData({ ...data, address: e.target.value })}
                    placeholder="Ex: Str. Exemplu 12, Sector 3, București"
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    required
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

                <button
                  type="submit"
                  disabled={!canContinue}
                  className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
                >
                  Pregătește emailul
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </form>
            ) : isMobile ? (
              // ─── MOBILE FLOW: 1 ecran cu disclaimer poze + 1 buton mailto ───
              // Fără EmailChoicePanel pe mobil — sare peste „pregătire" și
              // duce direct în aplicația de email defaut (Gmail/iOS Mail/etc).
              <div className="p-5 space-y-4">
                {(imagini && imagini.length > 0) && (
                  <div className="rounded-[var(--radius-xs)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Paperclip size={14} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
                      <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                        <strong>Important:</strong> descarcă pozele de mai jos și atașează-le manual la mail după ce apeși <strong>Trimite</strong>. Aplicațiile de mail nu permit pre-atașare automată din web.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {imagini.map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => void downloadImageAsJpeg(url, `${code}-poza-${i + 1}`)}
                          className="inline-flex items-center gap-1 h-8 px-2 rounded-[var(--radius-xs)] bg-white dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                        >
                          <Download size={11} aria-hidden="true" />
                          Poza {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={buildMailtoLink(emailInput)}
                  className="w-full inline-flex items-center justify-center gap-2 h-12 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
                >
                  <Mail size={18} aria-hidden="true" />
                  Trimite emailul
                </a>

                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="w-full h-9 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-[var(--radius-xs)] transition-colors"
                >
                  <span aria-hidden="true">←</span> Înapoi la datele tale
                </button>
              </div>
            ) : (
              // ─── DESKTOP FLOW: opțiuni multiple Gmail/Outlook/mailto/copy ───
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-[var(--radius-xs)] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <AlertCircle size={14} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-blue-900 dark:text-blue-300">
                    Se deschide un tab nou cu emailul deja completat — destinatari, subiect, corp. Citește pentru verificare și apeși <strong>Trimite</strong>.
                  </p>
                </div>
                <EmailChoicePanel input={emailInput} />
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="w-full h-9 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-[var(--radius-xs)] transition-colors"
                >
                  <span aria-hidden="true">←</span> Înapoi la datele tale
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
