"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Megaphone,
  User,
  Plus,
  X,
  Building2,
  Hash,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { ALL_COUNTIES } from "@/data/counties";

interface Form {
  // Required
  title: string;
  location_name: string;
  start_at: string;
  description: string;
  submitter_name: string;
  submitter_email: string;
  // Optional
  subtitle: string;
  cause: string;
  end_at: string;
  city: string;
  county_slug: string;
  organizer: string;
  organizer_url: string;
  external_url: string;
  hashtag: string;
  expected_attendance: string;
  demands: string[];
  submitter_note: string;
}

const EMPTY: Form = {
  title: "",
  location_name: "",
  start_at: "",
  description: "",
  submitter_name: "",
  submitter_email: "",
  subtitle: "",
  cause: "",
  end_at: "",
  city: "",
  county_slug: "",
  organizer: "",
  organizer_url: "",
  external_url: "",
  hashtag: "",
  expected_attendance: "",
  demands: [],
  submitter_note: "",
};

function inputDateTimeToIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

export function ProteSubmitForm() {
  const { toast } = useToast();
  const [f, setF] = useState<Form>(EMPTY);
  const [demandInput, setDemandInput] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const addDemand = () => {
    const v = demandInput.trim();
    if (!v) return;
    if (f.demands.length >= 10) {
      toast("Max 10 revendicări — restul în descriere.", "error");
      return;
    }
    setF({ ...f, demands: [...f.demands, v] });
    setDemandInput("");
  };

  const removeDemand = (i: number) => {
    setF({ ...f, demands: f.demands.filter((_, idx) => idx !== i) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side guard pentru cele obligatorii
    if (!f.title.trim() || f.title.trim().length < 5) {
      setError("Titlul trebuie să aibă minim 5 caractere.");
      return;
    }
    if (!f.location_name.trim()) {
      setError("Locația e obligatorie.");
      return;
    }
    if (!f.start_at) {
      setError("Data și ora de început sunt obligatorii.");
      return;
    }
    if (!f.description.trim() || f.description.trim().length < 20) {
      setError("Descrie protestul în câteva propoziții (min 20 caractere).");
      return;
    }
    if (!f.submitter_name.trim()) {
      setError("Numele tău e obligatoriu pentru contact.");
      return;
    }
    if (!f.submitter_email.trim() || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(f.submitter_email)) {
      setError("Email valid necesar pentru contact.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: f.title.trim(),
        location_name: f.location_name.trim(),
        start_at: inputDateTimeToIso(f.start_at),
        description: f.description.trim(),
        submitter_name: f.submitter_name.trim(),
        submitter_email: f.submitter_email.trim().toLowerCase(),
      };
      // Optional fields — include only if non-empty
      if (f.subtitle.trim()) payload.subtitle = f.subtitle.trim();
      if (f.cause.trim()) payload.cause = f.cause.trim();
      if (f.end_at) payload.end_at = inputDateTimeToIso(f.end_at);
      if (f.city.trim()) payload.city = f.city.trim();
      if (f.county_slug) payload.county_slug = f.county_slug;
      if (f.organizer.trim()) payload.organizer = f.organizer.trim();
      if (f.organizer_url.trim()) payload.organizer_url = f.organizer_url.trim();
      if (f.external_url.trim()) payload.external_url = f.external_url.trim();
      if (f.hashtag.trim()) payload.hashtag = f.hashtag.trim();
      if (f.expected_attendance) {
        payload.expected_attendance = Number(f.expected_attendance);
      }
      if (f.demands.length > 0) payload.demands = f.demands;
      if (f.submitter_note.trim()) payload.submitter_note = f.submitter_note.trim();

      const res = await fetch("/api/proteste/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare server");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-emerald-500/5 border-2 border-emerald-500/30 rounded-[var(--radius-lg)] p-8 md:p-10 text-center">
        <div
          className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/15 grid place-items-center"
          aria-hidden="true"
        >
          <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-lg md:text-xl mb-2">
          Submisie trimisă, mulțumim!
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed mb-4">
          Echipa Civia verifică propunerea ta în <strong>24–48h</strong>. Dacă protestul
          îndeplinește criteriile (eveniment public, anunțat, pașnic), va apărea
          la <Link href="/proteste" className="text-[var(--color-primary)] hover:underline">/proteste</Link>.
          Te contactăm pe <strong>{f.submitter_email}</strong> dacă avem nevoie de clarificări.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link
            href="/proteste"
            className="inline-flex items-center h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            ← Toate protestele
          </Link>
          <button
            type="button"
            onClick={() => {
              setF(EMPTY);
              setDone(false);
            }}
            className="inline-flex items-center h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg)] transition-colors"
          >
            Trimite altul
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 md:p-7 shadow-[var(--shadow-1)] space-y-7"
    >
      {/* SECTION 1 — Esențiale */}
      <Section
        title="Despre protest"
        subtitle="Câmpurile cu * sunt obligatorii."
        icon={Megaphone}
      >
        <Field label="Titlul protestului *" hint='Scurt, descriptiv. Ex: „Marș pentru aer curat în București"'>
          <input
            type="text"
            value={f.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Ex: Marș pentru aer curat în București"
            maxLength={200}
            required
            className={inputCls}
          />
        </Field>

        <Field
          label="Descriere *"
          hint="Explică în câteva propoziții despre ce e protestul, de ce se organizează."
        >
          <textarea
            value={f.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Descrie cauza, contextul, ce vor să transmită protestatarii..."
            rows={6}
            minLength={20}
            maxLength={20000}
            required
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </Field>
      </Section>

      {/* SECTION 2 — Când + Unde */}
      <Section title="Când și unde" icon={Calendar}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Data și ora începutului *">
            <input
              type="datetime-local"
              value={f.start_at}
              onChange={(e) => update("start_at", e.target.value)}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Sfârșit estimat (opțional)">
            <input
              type="datetime-local"
              value={f.end_at}
              onChange={(e) => update("end_at", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Locație *" hint='Numele locului. Ex: „Piața Victoriei", „Centrul vechi"'>
          <input
            type="text"
            value={f.location_name}
            onChange={(e) => update("location_name", e.target.value)}
            placeholder="Ex: Piața Victoriei"
            maxLength={200}
            required
            className={inputCls}
          />
        </Field>
        <div className="grid sm:grid-cols-[1fr_180px] gap-3">
          <Field label="Oraș">
            <input
              type="text"
              value={f.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="București"
              maxLength={120}
              className={inputCls}
            />
          </Field>
          <Field label="Județ">
            <select
              value={f.county_slug}
              onChange={(e) => update("county_slug", e.target.value)}
              className={inputCls}
            >
              <option value="">— niciunul —</option>
              {ALL_COUNTIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* SECTION 3 — Contact (REQUIRED for moderation) */}
      <Section
        title="Date de contact (private)"
        subtitle="Folosite DOAR ca admin-ul să poată confirma cu tine. Nu apar public."
        icon={User}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Numele tău *">
            <input
              type="text"
              value={f.submitter_name}
              onChange={(e) => update("submitter_name", e.target.value)}
              placeholder="Andrei Popescu"
              maxLength={120}
              required
              autoComplete="name"
              className={inputCls}
            />
          </Field>
          <Field label="Email *" hint="Te contactăm aici pentru clarificări">
            <input
              type="email"
              value={f.submitter_email}
              onChange={(e) => update("submitter_email", e.target.value)}
              placeholder="nume@exemplu.ro"
              maxLength={200}
              required
              autoComplete="email"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Mesaj pentru admin (opțional)" hint="Context, sursă, link-uri suplimentare etc.">
          <textarea
            value={f.submitter_note}
            onChange={(e) => update("submitter_note", e.target.value)}
            placeholder="Orice detaliu care ne ajută să verificăm rapid..."
            rows={3}
            maxLength={2000}
            className={`${inputCls} resize-y`}
          />
        </Field>
      </Section>

      {/* SECTION 4 — Optional toggle */}
      <div className="border-t border-[var(--color-border)] pt-5">
        <button
          type="button"
          onClick={() => setShowOptional((s) => !s)}
          className="w-full flex items-center justify-between gap-2 text-sm font-semibold py-2 hover:text-[var(--color-primary)] transition-colors"
          aria-expanded={showOptional}
        >
          <span className="inline-flex items-center gap-2">
            <Plus size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
            Mai multe detalii (opțional)
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform ${showOptional ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {showOptional && (
          <div className="space-y-7 mt-5">
            <Section title="Detalii suplimentare" icon={Hash}>
              <Field label="Cauza pe scurt" hint='3-8 cuvinte. Ex: „Poluarea din capitală"'>
                <input
                  type="text"
                  value={f.cause}
                  onChange={(e) => update("cause", e.target.value)}
                  placeholder='ex: "Poluarea din Capitală"'
                  maxLength={120}
                  className={inputCls}
                />
              </Field>
              <Field label="Subtitlu / one-liner">
                <input
                  type="text"
                  value={f.subtitle}
                  onChange={(e) => update("subtitle", e.target.value)}
                  placeholder="Propoziție-două care explică ce e protestul"
                  maxLength={280}
                  className={inputCls}
                />
              </Field>
              <Field label="Hashtag">
                <input
                  type="text"
                  value={f.hashtag}
                  onChange={(e) => update("hashtag", e.target.value)}
                  placeholder="#FaraCorupție"
                  maxLength={60}
                  className={inputCls}
                />
              </Field>
              <Field
                label="Estimare participanți"
                hint="Câți oameni așteptați? Lasă gol dacă nu știi."
              >
                <input
                  type="number"
                  min={0}
                  value={f.expected_attendance}
                  onChange={(e) => update("expected_attendance", e.target.value)}
                  placeholder="ex: 5000"
                  className={inputCls}
                />
              </Field>
            </Section>

            <Section title="Organizator" icon={Building2}>
              <Field label="Cine organizează">
                <input
                  type="text"
                  value={f.organizer}
                  onChange={(e) => update("organizer", e.target.value)}
                  placeholder="Declic, Greenpeace România, Inițiativa Cetățeni etc."
                  maxLength={200}
                  className={inputCls}
                />
              </Field>
              <Field label="Site organizator">
                <input
                  type="url"
                  value={f.organizer_url}
                  onChange={(e) => update("organizer_url", e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </Field>
              <Field
                label="Eveniment oficial (Facebook etc.)"
                hint="Link către evenimentul de pe Facebook, site oficial, etc."
              >
                <input
                  type="url"
                  value={f.external_url}
                  onChange={(e) => update("external_url", e.target.value)}
                  placeholder="https://facebook.com/events/..."
                  className={inputCls}
                />
              </Field>
            </Section>

            <Section title="Revendicări" icon={Megaphone}>
              <Field
                label="Ce cer protestatarii?"
                hint='Apasă Enter sau „Adaugă" după fiecare punct'
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={demandInput}
                    onChange={(e) => setDemandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDemand();
                      }
                    }}
                    placeholder='ex: "Demisia ministrului X"'
                    maxLength={500}
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={addDemand}
                    className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
                  >
                    Adaugă
                  </button>
                </div>
                {f.demands.length > 0 && (
                  <ol className="mt-2 space-y-1">
                    {f.demands.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-2"
                      >
                        <span className="font-mono text-[10px] text-[var(--color-text-muted)] mt-0.5 shrink-0">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{d}</span>
                        <button
                          type="button"
                          onClick={() => removeDemand(i)}
                          className="shrink-0 text-rose-500 hover:text-rose-700"
                          aria-label="Șterge"
                        >
                          <X size={11} />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </Field>
            </Section>
          </div>
        )}
      </div>

      {/* GUIDELINES */}
      <aside className="bg-amber-500/5 border border-amber-500/30 rounded-[var(--radius-md)] p-4 text-xs leading-relaxed">
        <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1.5 inline-flex items-center gap-1.5">
          <AlertTriangle size={12} aria-hidden="true" />
          Reguli de submisie
        </p>
        <ul className="space-y-1 text-[var(--color-text-muted)] list-disc pl-4">
          <li>Doar evenimente <strong>publice</strong>, anunțate.</li>
          <li>Civia nu publică proteste violente sau care incită la ură.</li>
          <li>Nu duplica un protest deja listat — verifică <Link href="/proteste" className="text-[var(--color-primary)] hover:underline">/proteste</Link> înainte.</li>
          <li>Trimitem confirmare pe email când e aprobat sau dacă avem întrebări.</li>
        </ul>
      </aside>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-[var(--radius-xs)] p-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* SUBMIT */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href="/proteste"
          className="h-11 px-4 inline-flex items-center rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg)] transition-colors"
        >
          Anulează
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 h-11 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          {submitting && <Loader2 size={14} className="motion-safe:animate-spin" />}
          {submitting ? "Se trimite..." : "Trimite spre verificare"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[var(--color-text)] mb-1">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[10px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
          {hint}
        </span>
      )}
    </label>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base inline-flex items-center gap-2 mb-1">
        <Icon size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
        {title}
      </legend>
      {subtitle && (
        <p className="text-xs text-[var(--color-text-muted)] -mt-2 leading-relaxed">
          {subtitle}
        </p>
      )}
      {children}
    </fieldset>
  );
}

