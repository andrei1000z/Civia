"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

/**
 * 2026-06-07 (audit P1) — review manual al unui răspuns clasificat „necunoscut"
 * (sau greșit). Adminul corectează clasificarea + opțional avansează sesizarea.
 */
const REPLY_STATUSES: Array<{ value: string; label: string }> = [
  { value: "inregistrata", label: "Înregistrată (confirmare)" },
  { value: "in-lucru", label: "În lucru (intervenție programată)" },
  { value: "rezolvat", label: "Rezolvat" },
  { value: "redirectionata", label: "Redirecționată (altă autoritate)" },
  { value: "respins", label: "Respins" },
  { value: "cerere_informatii", label: "Cerere de informații" },
  { value: "necunoscut", label: "Necunoscut (lasă pentru review)" },
];

// Statusurile care chiar avansează sesizarea (vezi computeStatusUpdate).
const ADVANCING = new Set(["inregistrata", "in-lucru", "rezolvat", "redirectionata"]);

export function ReplyManualReviewForm({
  replyId,
  currentStatus,
  hasSesizare,
}: {
  replyId: string;
  currentStatus: string | null;
  hasSesizare: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(
    currentStatus && currentStatus !== "necunoscut" ? currentStatus : "inregistrata",
  );
  const [applyToSesizare, setApplyToSesizare] = useState<boolean>(hasSesizare);
  const [linkCode, setLinkCode] = useState(""); // legare orfan: codul sesizării
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const willLink = !hasSesizare && linkCode.trim().length > 0;
      const res = await fetch(`/api/admin/inbox/reply/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply_status: status,
          apply_to_sesizare: applyToSesizare && (hasSesizare || willLink),
          ...(willLink ? { link_code: linkCode.trim() } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; sesizareStatus?: string | null };
      if (!res.ok) {
        setError(json.error ?? `Eroare ${res.status}`);
        return;
      }
      setDone(
        willLink
          ? `Legat de sesizarea ${linkCode.trim()}${json.sesizareStatus ? ` → „${json.sesizareStatus}"` : ""}.`
          : json.sesizareStatus
            ? `Salvat. Sesizarea → „${json.sesizareStatus}".`
            : "Salvat (clasificarea răspunsului actualizată).",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare rețea");
    } finally {
      setBusy(false);
    }
  }

  const canAdvance = ADVANCING.has(status);

  return (
    <section className="mb-6 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
      <h2 className="text-sm font-bold mb-1 text-amber-900 dark:text-amber-300">
        Revizuire manuală
      </h2>
      <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mb-3">
        Corectează clasificarea răspunsului și, opțional, avansează statusul sesizării.
      </p>

      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
        Clasificare răspuns
      </label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="h-10 w-full max-w-sm px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        {REPLY_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {!hasSesizare && (
        <div className="mt-3">
          <label htmlFor="link-code" className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Răspuns orfan — leagă-l de sesizarea (cod)
          </label>
          <input
            id="link-code"
            type="text"
            inputMode="numeric"
            value={linkCode}
            onChange={(e) => setLinkCode(e.target.value)}
            placeholder="ex: 00007"
            className="h-10 w-40 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-mono text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>
      )}

      {(hasSesizare || linkCode.trim().length > 0) && (
        <label
          className={`mt-3 flex items-center gap-2 text-sm ${canAdvance ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}
        >
          <input
            type="checkbox"
            checked={applyToSesizare && canAdvance}
            disabled={!canAdvance}
            onChange={(e) => setApplyToSesizare(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)]"
          />
          Aplică pe sesizare (avansează statusul)
          {!canAdvance && <span className="text-xs">— indisponibil pentru acest tip</span>}
        </label>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          Salvează
        </button>
        {done && <span className="text-xs text-emerald-600 dark:text-emerald-400">{done}</span>}
        {error && <span className="text-xs text-red-500" role="alert">{error}</span>}
      </div>
    </section>
  );
}
