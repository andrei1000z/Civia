"use client";

import { useState } from "react";
import { Copy, Check, Mail, FileText, Building2 } from "lucide-react";
import { buildCerere544, CATEGORII_544, SUBIECT_544 } from "@/lib/legea544/template";

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-[var(--color-primary)] transition";
const labelCls = "block text-xs font-semibold text-[var(--color-text-muted)] mb-1";

export function Cerere544Generator() {
  const [autoritate, setAutoritate] = useState("");
  const [emailAutoritate, setEmailAutoritate] = useState("");
  const [informatie, setInformatie] = useState("");
  const [nume, setNume] = useState("");
  const [email, setEmail] = useState("");
  const [format, setFormat] = useState<"electronic" | "hartie">("electronic");
  const [copied, setCopied] = useState(false);

  // Data curentă, formatată în română. new Date() e OK în client la runtime.
  const data = new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const text = buildCerere544({
    autoritate,
    informatie,
    numeSolicitant: nume,
    emailSolicitant: email,
    data,
    format,
  });

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailAutoritate.trim());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponibil — utilizatorul poate selecta manual */
    }
  };

  const mailtoHref =
    `mailto:${encodeURIComponent(emailAutoritate.trim())}` +
    `?subject=${encodeURIComponent(SUBIECT_544)}` +
    `&body=${encodeURIComponent(text)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ─── Formular ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
            <Building2 size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Către cine trimiți
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="c544-aut" className={labelCls}>Autoritatea / instituția publică</label>
              <input id="c544-aut" className={inputCls} value={autoritate} onChange={(e) => setAutoritate(e.target.value)} placeholder="ex: Primăria Municipiului București" />
            </div>
            <div>
              <label htmlFor="c544-autmail" className={labelCls}>E-mailul autorității (pentru butonul de trimitere)</label>
              <input id="c544-autmail" type="email" inputMode="email" className={inputCls} value={emailAutoritate} onChange={(e) => setEmailAutoritate(e.target.value)} placeholder="ex: registratura@pmb.ro" />
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]">
          <h2 className="mb-3 text-sm font-bold text-[var(--color-text)]">Ce informație ceri</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CATEGORII_544.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setInformatie(c.exemplu)}
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
              >
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
          <label htmlFor="c544-info" className={labelCls}>Descrierea informației solicitate</label>
          <textarea
            id="c544-info"
            className={`${inputCls} min-h-[110px] resize-y`}
            value={informatie}
            onChange={(e) => setInformatie(e.target.value)}
            placeholder="Apasă o categorie de mai sus sau scrie clar ce date publice vrei…"
          />
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]">
          <h2 className="mb-3 text-sm font-bold text-[var(--color-text)]">Datele tale</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="c544-nume" className={labelCls}>Nume</label>
              <input id="c544-nume" className={inputCls} value={nume} onChange={(e) => setNume(e.target.value)} placeholder="Prenume Nume" />
            </div>
            <div>
              <label htmlFor="c544-mail" className={labelCls}>E-mailul tău (pentru răspuns)</label>
              <input id="c544-mail" type="email" inputMode="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nume@exemplu.ro" />
            </div>
          </div>
          <fieldset className="mt-3">
            <legend className={labelCls}>Cum vrei răspunsul</legend>
            <div className="flex gap-2">
              {([["electronic", "Electronic (recomandat)"], ["hartie", "Pe hârtie"]] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFormat(val)}
                  aria-pressed={format === val}
                  className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition ${
                    format === val
                      ? "bg-[var(--color-primary)] text-white"
                      : "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {/* ─── Previzualizare + acțiuni ──────────────────────────── */}
      <div className="space-y-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-[var(--shadow-1)]">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
            <FileText size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Cererea ta (generată automat)
          </h2>
          <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--color-surface)] p-3 text-[13px] leading-relaxed text-[var(--color-text)]">
            {text}
          </pre>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-1)] hover:opacity-90 transition"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? "Copiat în clipboard" : "Copiază cererea"}
          </button>
          <a
            href={emailValid ? mailtoHref : undefined}
            aria-disabled={!emailValid}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold transition ${
              emailValid
                ? "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed opacity-60"
            }`}
            onClick={(e) => { if (!emailValid) e.preventDefault(); }}
          >
            <Mail size={15} aria-hidden="true" />
            Trimite pe e-mail
          </a>
        </div>
        {!emailValid && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Completează e-mailul autorității ca să poți trimite direct. Poți oricând copia textul și-l trimiți manual.
          </p>
        )}
      </div>
    </div>
  );
}
