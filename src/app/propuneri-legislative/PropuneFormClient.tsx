"use client";

import { useState } from "react";
import { Plus, Loader2, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { AUTHORITIES, CATEGORII_PROPUNERI, VOTE_THRESHOLD_SEND } from "@/lib/propuneri-legislative/authorities";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;

interface FormData {
  titlu: string;
  problema: string;
  solutia: string;
  categorie: string;
  destinatar_key: string;
  is_anonymous: boolean;
  author_display_name: string;
}

interface AiResult {
  titlu_formal: string;
  problema_formala: string;
  solutia_formala: string;
  temei_legal: string;
  impact_estimat: string;
  precedente: string;
}

const INITIAL: FormData = {
  titlu: "",
  problema: "",
  solutia: "",
  categorie: "trafic_rutier",
  destinatar_key: "IGPR",
  is_anonymous: false,
  author_display_name: "",
};

export function PropuneFormClient() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const router = useRouter();

  const authority = AUTHORITIES[form.destinatar_key];

  async function handleSubmitStep2() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/propuneri-legislative/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          is_anonymous: form.is_anonymous,
        }),
      });
      const json = await res.json() as { ok?: boolean; id?: string; ai_result?: AiResult; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Eroare la salvare");
        return;
      }
      setAiResult(json.ai_result ?? null);
      setSubmitted(json.id ?? null);
      setStep(3);
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setStep(1);
    setForm(INITIAL);
    setAiResult(null);
    setError(null);
    setSubmitted(null);
    if (submitted) router.refresh();
  }

  const canGoStep2 = form.titlu.length >= 10 && form.problema.length >= 50 && form.solutia.length >= 50;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        <Plus size={14} />
        Propune o schimbare
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-xl)] border border-[var(--color-border)]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <h2 className="font-bold text-lg">Propunere legislativă</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {step === 1 && "Pasul 1/3 — Descrie problema și soluția"}
              {step === 2 && "Pasul 2/3 — Alege autoritatea și detalii"}
              {step === 3 && "Pasul 3/3 — Publicat! Distribuie pentru susțineri"}
            </p>
          </div>
          <button onClick={close} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-2xl leading-none">×</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-5 pt-4">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`} />
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Titlu propunere <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ex: Reducerea vitezei la 30 km/h în zone rezidențiale"
                  value={form.titlu}
                  onChange={(e) => setForm({ ...form, titlu: e.target.value })}
                  maxLength={200}
                  className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] text-sm"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{form.titlu.length}/200 caractere (min 10)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Problema descrisă <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Care este problema actuală? Ce impact negativ are? Există date/statistici? (min 50 caractere)"
                  value={form.problema}
                  onChange={(e) => setForm({ ...form, problema: e.target.value })}
                  maxLength={5000}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] text-sm resize-y"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{form.problema.length}/5000</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Soluția propusă <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Ce schimbare concretă propui? Cum ar trebui modificată legea/regulamentul? (min 50 caractere)"
                  value={form.solutia}
                  onChange={(e) => setForm({ ...form, solutia: e.target.value })}
                  maxLength={5000}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] text-sm resize-y"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{form.solutia.length}/5000</p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canGoStep2}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  Continuă
                  <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Categoria</label>
                  <select
                    value={form.categorie}
                    onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm"
                  >
                    {CATEGORII_PROPUNERI.map((c) => (
                      <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Destinatar</label>
                  <select
                    value={form.destinatar_key}
                    onChange={(e) => setForm({ ...form, destinatar_key: e.target.value })}
                    className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm"
                  >
                    {Object.values(AUTHORITIES).map((a) => (
                      <option key={a.key} value={a.key}>{a.icon} {a.shortName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {authority && (
                <div className="p-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                  <p className="text-xs font-semibold mb-1">{authority.icon} {authority.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{authority.description}</p>
                  <p className="text-[10px] text-[var(--color-primary)] mt-1">📬 {authority.email}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Temei: {authority.legalBasis}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1.5">Nume afișat (opțional)</label>
                <input
                  type="text"
                  placeholder="Cum vrei să apari pe propunere (gol = anonim)"
                  value={form.author_display_name}
                  onChange={(e) => setForm({ ...form, author_display_name: e.target.value })}
                  maxLength={80}
                  className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_anon"
                  checked={form.is_anonymous}
                  onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_anon" className="text-sm text-[var(--color-text-muted)]">
                  Publică anonim (fără nume vizibil)
                </label>
              </div>

              <div className="p-3 rounded-[var(--radius-xs)] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-1.5">
                  <Sparkles size={12} className="mt-0.5 shrink-0" />
                  AI-ul Groq va citi textul tău și va genera automat un document formal cu temei legal,
                  impact estimat și precedente din UE. Durează ~5 secunde.
                </p>
              </div>

              {error && (
                <p className="text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-[var(--radius-xs)]">{error}</p>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <ChevronLeft size={14} />
                  Înapoi
                </button>
                <button
                  onClick={handleSubmitStep2}
                  disabled={loading}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-60 hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {loading ? "AI formalizează..." : "Publică propunerea"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3 — Success ── */}
          {step === 3 && submitted && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Publicat!</h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Propunerea ta este acum live. La <strong>{VOTE_THRESHOLD_SEND} susținători</strong>,
                Civia o trimite automat la {authority?.shortName}.
              </p>

              {aiResult && (
                <div className="text-left p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] mb-4">
                  <p className="text-xs font-bold text-[var(--color-primary)] mb-2 flex items-center gap-1">
                    <Sparkles size={10} />
                    Text formalizat de AI
                  </p>
                  <p className="text-sm font-semibold mb-2">{aiResult.titlu_formal}</p>
                  {aiResult.temei_legal && (
                    <p className="text-xs text-[var(--color-text-muted)]">⚖️ {aiResult.temei_legal}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <a
                  href={`/propuneri-legislative/${submitted}`}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold"
                >
                  Vezi propunerea
                </a>
                <button
                  onClick={close}
                  className="inline-flex items-center justify-center h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm"
                >
                  Închide
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
