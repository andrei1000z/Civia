"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ALL_COUNTIES } from "@/data/counties";

const AUTHORITY_KINDS = [
  { value: "primarie_sector", label: "Primărie sector București" },
  { value: "primarie_municipiu", label: "Primărie municipiu" },
  { value: "primarie_judet", label: "Primărie județ" },
  { value: "consiliu_judetean", label: "Consiliu județean" },
  { value: "politie_locala", label: "Poliție locală" },
  { value: "garda_mediu", label: "Garda de Mediu" },
  { value: "salubritate", label: "Operator salubritate" },
  { value: "apa_nova", label: "Apa Nova / operator apă" },
  { value: "termoenergetica", label: "Termoenergetica / termoficare" },
  { value: "cnair", label: "CNAIR (drumuri naționale)" },
  { value: "altele", label: "Altă autoritate" },
] as const;

export function AuthorityRegisterForm() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honey, setHoney] = useState("");
  const [form, setForm] = useState({
    authority_name: "",
    authority_kind: "primarie_sector" as typeof AUTHORITY_KINDS[number]["value"],
    county: "",
    sector: "",
    official_email: "",
    phone: "",
    website: "",
    role_in_authority: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Trebuie sa te autentifici intai (Google sign-in din meniul de sus).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/authority/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _honey: honey }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Eroare la inregistrare");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Eroare de retea. Reincearca.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-2 lc-text-gradient">
          Cerere trimisa!
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
          Echipa Civia verifica manual email-ul oficial + identitatea ta in 1-2 zile.
          Vei primi notificare email cand contul e activ.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Inapoi la Civia
        </Link>
      </div>
    );
  }

  const needsSector = form.authority_kind === "primarie_sector" || form.authority_kind === "politie_locala";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-5">
      {!user && (
        <div
          role="alert"
          className="p-4 rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-3"
        >
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-amber-900 dark:text-amber-300">
            <p className="font-semibold mb-1">Autentifica-te intai</p>
            <p className="text-xs leading-relaxed">
              Apasa pe meniul cu icon de utilizator (sus dreapta) si alege Sign in
              cu Google. Apoi reincarca pagina si completeaza formul.
            </p>
          </div>
        </div>
      )}

      {/* Honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={honey}
        onChange={(e) => setHoney(e.target.value)}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none -z-10"
        style={{ position: "absolute", left: "-9999px" }}
      />

      <Field label="Numele autoritatii *">
        <input
          type="text"
          value={form.authority_name}
          onChange={(e) => setForm((f) => ({ ...f, authority_name: e.target.value }))}
          placeholder="Ex: Primaria Sectorului 5 Bucuresti"
          required
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
      </Field>

      <Field label="Tipul autoritatii *">
        <select
          value={form.authority_kind}
          onChange={(e) => setForm((f) => ({ ...f, authority_kind: e.target.value as typeof form.authority_kind }))}
          required
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {AUTHORITY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Judet">
          <select
            value={form.county}
            onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))}
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <option value="">— alege —</option>
            {ALL_COUNTIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        {needsSector && (
          <Field label="Sector (Bucuresti)">
            <select
              value={form.sector}
              onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
              className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <option value="">— alege —</option>
              <option>Sector 1</option>
              <option>Sector 2</option>
              <option>Sector 3</option>
              <option>Sector 4</option>
              <option>Sector 5</option>
              <option>Sector 6</option>
            </select>
          </Field>
        )}
      </div>

      <Field label="Email OFICIAL al autoritatii * (pentru verificare)">
        <input
          type="email"
          value={form.official_email}
          onChange={(e) => setForm((f) => ({ ...f, official_email: e.target.value }))}
          placeholder="primarie@sector5.ro"
          required
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Email-ul trebuie sa fie listat public pe site-ul autoritatii.
        </p>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Telefon (optional)">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="021xxxxxx"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </Field>
        <Field label="Website (optional)">
          <input
            type="url"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://sector5.ro"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </Field>
      </div>

      <Field label="Rolul TAU in autoritate *">
        <input
          type="text"
          value={form.role_in_authority}
          onChange={(e) => setForm((f) => ({ ...f, role_in_authority: e.target.value }))}
          placeholder="Ex: Primar / Viceprimar / Sef relatii publice"
          required
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
      </Field>

      {error && (
        <div role="alert" className="p-3 rounded-[var(--radius-xs)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !user}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] bg-gradient-to-r from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all lc-shine focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Se trimite...
          </>
        ) : (
          <>
            <Building2 size={16} aria-hidden="true" />
            Trimite cererea de inregistrare
          </>
        )}
      </button>

      <p className="text-xs text-[var(--color-text-muted)] text-center leading-relaxed">
        Cererea ta va fi verificata manual de echipa Civia in 1-2 zile.
        Te contactam pe email oficial cand contul e activ.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">
        {label}
      </label>
      {children}
    </div>
  );
}
