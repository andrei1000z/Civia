"use client";

import { useState } from "react";
import { Copy, Check, Mail, Building2 } from "lucide-react";
import { buildCerereBP, SUBIECT_BP } from "@/lib/bugetare/template";

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-[var(--color-primary)] transition";
const labelCls = "block text-xs font-semibold text-[var(--color-text-muted)] mb-1";

/** Generatorul „Cere bugetare participativă în orașul tău" — FAZA 4.
 *  Același pattern ca generatorul de cereri 544 (formular → preview → copiere
 *  sau mailto), refolosind temeiul legal OG 27/2002 + Legea 52/2003. */
export function CerereBPGenerator() {
  const [oras, setOras] = useState("");
  const [primarie, setPrimarie] = useState("");
  const [emailPrimarie, setEmailPrimarie] = useState("");
  const [nume, setNume] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const data = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const text = buildCerereBP({ oras, primarie, numeSolicitant: nume, emailSolicitant: email, data });
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailPrimarie.trim());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponibil */ }
  };

  const mailtoHref =
    `mailto:${encodeURIComponent(emailPrimarie.trim())}?subject=${encodeURIComponent(SUBIECT_BP)}&body=${encodeURIComponent(text)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
            <Building2 size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Orașul tău
          </h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="bp-oras" className={labelCls}>Orașul / comuna</label>
              <input id="bp-oras" className={inputCls} value={oras} onChange={(e) => setOras(e.target.value)} placeholder="ex: Ploiești" />
            </div>
            <div>
              <label htmlFor="bp-primarie" className={labelCls}>Primăria destinatară</label>
              <input id="bp-primarie" className={inputCls} value={primarie} onChange={(e) => setPrimarie(e.target.value)} placeholder="ex: Primăria Municipiului Ploiești" />
            </div>
            <div>
              <label htmlFor="bp-mail-prim" className={labelCls}>E-mailul primăriei (pentru trimitere directă)</label>
              <input id="bp-mail-prim" type="email" inputMode="email" className={inputCls} value={emailPrimarie} onChange={(e) => setEmailPrimarie(e.target.value)} placeholder="ex: registratura@ploiesti.ro" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="bp-nume" className={labelCls}>Numele tău</label>
                <input id="bp-nume" className={inputCls} value={nume} onChange={(e) => setNume(e.target.value)} placeholder="Prenume Nume" />
              </div>
              <div>
                <label htmlFor="bp-email" className={labelCls}>E-mailul tău (pentru răspuns)</label>
                <input id="bp-email" type="email" inputMode="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nume@exemplu.ro" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-[var(--shadow-1)]">
          <h3 className="mb-2 text-sm font-bold text-[var(--color-text)]">Cererea ta (generată automat)</h3>
          <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-3 text-[13px] leading-relaxed text-[var(--color-text)]">
            {text}
          </pre>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="btn-press inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-1)] hover:opacity-90 transition"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? "Copiat în clipboard" : "Copiază cererea"}
          </button>
          <a
            href={emailValid ? mailtoHref : undefined}
            aria-disabled={!emailValid}
            onClick={(e) => { if (!emailValid) e.preventDefault(); }}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold transition ${
              emailValid
                ? "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed opacity-60"
            }`}
          >
            <Mail size={15} aria-hidden="true" />
            Trimite pe e-mail
          </a>
        </div>
        {!emailValid && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Completează e-mailul primăriei ca să trimiți direct — sau copiază textul și trimite-l manual.
          </p>
        )}
      </div>
    </div>
  );
}
