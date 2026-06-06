"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, ShieldAlert, Loader2, Lock, X } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * 2026-06-07 (audit #11) — autentificare în doi pași (TOTP) pentru cont.
 *
 * Folosește MFA NATIV Supabase (`auth.mfa.*`) — secretul + factorii trăiesc în
 * schema auth, zero migrare, zero stocare custom de secrete. Flow opt-in:
 * enroll → QR + cod de verificare → factor „verified". Complet ADITIV: nu
 * atinge login-ul magic-link, deci nu poate bloca pe nimeni. Enforcement-ul
 * pentru admini (AAL2) e un pas separat, după ce enrollment-ul e testat live.
 */
type Status = "loading" | "disabled" | "enrolling" | "enabled" | "error";

export function MfaSetup() {
  const [status, setStatus] = useState<Status>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowser();

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) {
      setStatus("error");
      setError("Nu am putut citi starea 2FA. Reîncarcă pagina.");
      return;
    }
    const totp = (data?.totp ?? []) as Array<{ id: string; status: string }>;
    const verified = totp.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setStatus("enabled");
    } else {
      setStatus("disabled");
    }
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    // Curăță factorii neverificați rămași dintr-un enroll abandonat anterior
    // (altfel se acumulează + numele intră în conflict).
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (e || !data) {
      setError(e?.message ?? "Nu am putut porni înrolarea 2FA.");
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode("");
    setStatus("enrolling");
  }

  async function verify() {
    const clean = code.replace(/\s/g, "");
    if (!factorId || clean.length < 6) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    setBusy(false);
    if (e) {
      setError("Cod greșit sau expirat. Verifică ora telefonului și mai încearcă.");
      return;
    }
    setCode("");
    setQrCode(null);
    setSecret(null);
    setStatus("enabled");
  }

  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setFactorId(null);
    setStatus("disabled");
  }

  const cardCls =
    "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5";

  if (status === "loading") {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Se verifică starea 2FA…
        </div>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
            status === "enabled"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
          }`}
        >
          {status === "enabled" ? (
            <ShieldCheck size={18} aria-hidden="true" />
          ) : (
            <ShieldAlert size={18} aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-[var(--color-text)]">
            Autentificare în doi pași (2FA)
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            {status === "enabled"
              ? "Activă — la conectare ți se va cere și un cod din aplicația de autentificare."
              : "Un strat extra de securitate: pe lângă linkul magic primit pe email, ceri un cod dintr-o aplicație (Google Authenticator, Aegis, 1Password)."}
          </p>
        </div>
      </div>

      {status === "disabled" && (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
          Activează 2FA
        </button>
      )}

      {status === "enrolling" && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            1. Scanează codul QR cu aplicația de autentificare. 2. Introdu codul de 6 cifre generat.
          </p>
          {qrCode && (
            <div className="inline-block rounded-[var(--radius-sm)] bg-white p-3 border border-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`}
                alt="Cod QR pentru configurarea 2FA"
                width={176}
                height={176}
                className="block"
              />
            </div>
          )}
          {secret && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Nu poți scana? Introdu manual cheia:{" "}
              <code className="font-mono text-[var(--color-text)] break-all">{secret}</code>
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void verify();
              }}
              placeholder="123456"
              aria-label="Cod de verificare 2FA"
              className="h-10 w-32 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-mono tracking-widest text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.replace(/\s/g, "").length < 6}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              Confirmă
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("disabled");
                setQrCode(null);
                setSecret(null);
                setCode("");
                setError(null);
              }}
              aria-label="Anulează configurarea 2FA"
              className="inline-flex items-center justify-center w-10 h-10 rounded-[var(--radius-button)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {status === "enabled" && (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/40 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border)]"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
          Dezactivează 2FA
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-500 mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
