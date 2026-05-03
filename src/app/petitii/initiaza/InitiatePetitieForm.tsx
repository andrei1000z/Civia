"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Megaphone,
  Sparkles,
  AlertTriangle,
  Loader2,
  Send,
  Tag,
  FileText,
  Target,
  MapPin,
  Hash,
} from "lucide-react";
import { createPetitie, type CreatePetitieState } from "@/actions/petitii-actions";
import { PETITIE_CATEGORII } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";

interface Props {
  userEmail: string | null;
}

const TARGETS = [
  { value: 500, label: "500", desc: "începător — local, focused" },
  { value: 1000, label: "1.000", desc: "mediu — județean / comunitar" },
  { value: 5000, label: "5.000", desc: "amplu — regional / national" },
  { value: 10000, label: "10.000", desc: "national — atrage atenția presei" },
  { value: 50000, label: "50.000", desc: "viral — necesită campanie activă" },
] as const;

const INITIAL: CreatePetitieState = { status: "idle" };

export function InitiatePetitieForm({ userEmail }: Props) {
  // useActionState e helper-ul nou Next 15+ pentru server actions cu state.
  // Înlocuiește vechiul useFormState (deprecated). Returnează tuple
  // [currentState, action, isPending].
  const [state, formAction] = useActionState(createPetitie, INITIAL);
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const fieldError = (k: string) => errors[k]?.[0] ?? null;

  return (
    <form
      action={formAction}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5 md:p-7 space-y-7"
    >
      {/* Banner top — Logged-in confirmation */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] -mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />
        Conectat ca <span className="font-mono text-[var(--color-text)]">{userEmail ?? "anonim"}</span>
      </div>

      {/* SECTION 1 — Titlu (the hook) */}
      <Section title="Titlul petiției" icon={Megaphone}>
        <Field
          label="Titlu *"
          hint='Scurt, clar, ferm. Începe cu o cerere („Vrem ca...", „Cerem...", „Stop..."). Max 160 caractere — primele 80 apar pe card.'
          error={fieldError("title")}
        >
          <input
            type="text"
            name="title"
            required
            maxLength={160}
            placeholder='Ex: „Vrem piste de bicicletă continue în Cluj-Napoca"'
            className={inputCls(!!fieldError("title"))}
          />
        </Field>
      </Section>

      {/* SECTION 2 — Categorie + județ */}
      <Section title="Unde se încadrează" icon={Tag}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Categorie *" error={fieldError("category")}>
            <select
              name="category"
              required
              defaultValue=""
              className={inputCls(!!fieldError("category"))}
            >
              <option value="" disabled>
                — alege o categorie —
              </option>
              {PETITIE_CATEGORII.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Județ (opțional)"
            hint="Lasă gol dacă petiția e națională."
            error={fieldError("county_code")}
          >
            <div className="relative">
              <MapPin
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                aria-hidden="true"
              />
              <select
                name="county_code"
                defaultValue=""
                className={`${inputCls(!!fieldError("county_code"))} pl-9`}
              >
                <option value="">Toată România (național)</option>
                {ALL_COUNTIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
      </Section>

      {/* SECTION 3 — Sumar + body */}
      <Section title="Conținut" icon={FileText}>
        <Field
          label="Sumar pe scurt *"
          hint='40-280 caractere. Apare pe card-ul din /petitii și pe share-uri sociale. Răspunde la „despre ce e?" în 2 propoziții.'
          error={fieldError("summary")}
        >
          <textarea
            name="summary"
            required
            minLength={40}
            maxLength={280}
            rows={3}
            placeholder='Ex: „Bicicliștii din Cluj sunt forțați să meargă pe trotuar sau pe carosabil din cauza pistelor fragmentate. Cerem un plan integrat de modernizare cu finalizare până în 2027."'
            className={`${inputCls(!!fieldError("summary"))} resize-y leading-relaxed`}
          />
        </Field>

        <Field
          label="Descriere detaliată *"
          hint='Markdown light suportat: ## Subtitlu, **bold**, - bullet, paragrafe separate de linie goală. Min 150 caractere.'
          error={fieldError("body")}
        >
          <textarea
            name="body"
            required
            minLength={150}
            maxLength={20000}
            rows={12}
            placeholder={`## Contextul problemei

Descrie situația concretă — ce nu merge, de când, cine e afectat.

## Ce cerem

Punct cu punct, ce solicită petiția. Folosește verbe imperative.

- Punct 1
- Punct 2
- Punct 3

## De ce contează

Câteva propoziții despre impact + cifre dacă ai (cu sursă).`}
            className={`${inputCls(!!fieldError("body"))} font-mono text-xs leading-relaxed resize-y`}
          />
        </Field>
      </Section>

      {/* SECTION 4 — Target signatures */}
      <Section title="Target de semnături" icon={Target}>
        <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
          Câte semnături vrei să strângi? Bara de progres se calculează raportat la ținta
          asta. Alege realist — un target prea mare descurajează semnatarii când văd 2%.
        </p>
        <fieldset className="grid grid-cols-2 sm:grid-cols-5 gap-2" aria-label="Target semnături">
          {TARGETS.map((t) => (
            <label
              key={t.value}
              className="cursor-pointer relative bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3 text-center hover:border-purple-500/40 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-500/10 has-[:checked]:shadow-[var(--shadow-2)] transition-all"
            >
              <input
                type="radio"
                name="target_signatures"
                value={t.value}
                defaultChecked={t.value === 1000}
                className="sr-only"
                required
              />
              <div className="font-[family-name:var(--font-sora)] font-extrabold text-lg text-[var(--color-text)] tabular-nums">
                {t.label}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-0.5">
                {t.desc}
              </div>
            </label>
          ))}
        </fieldset>
        {fieldError("target_signatures") && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-2">
            {fieldError("target_signatures")}
          </p>
        )}
      </Section>

      {/* General error */}
      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-[var(--radius-xs)] p-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}

      {/* Submit row */}
      <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)] inline-flex items-start gap-1.5 max-w-xs leading-relaxed">
          <Hash size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Slug-ul URL se generează automat din titlu. Petiția va fi disponibilă la
            <code className="font-mono ml-1">civia.ro/petitii/&lt;slug&gt;</code>
          </span>
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}

/**
 * SubmitButton folosește useFormStatus ca să afișeze loading state în
 * timpul submit-ului fără double-click. Component separat pentru că
 * useFormStatus DOAR funcționează în descendenți ai unui <form action={}>.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-button)] bg-purple-600 hover:bg-purple-700 active:scale-[0.97] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[var(--shadow-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
    >
      {pending ? (
        <>
          <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
          Se trimite spre verificare...
        </>
      ) : (
        <>
          <Send size={14} aria-hidden="true" />
          Trimite spre verificare
          <Sparkles size={12} className="opacity-70" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

// ============================================================
// Reusable form primitives
// ============================================================

const inputCls = (hasError: boolean) =>
  `w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
    hasError
      ? "border-rose-500 dark:border-rose-400"
      : "border-[var(--color-border)]"
  }`;

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[var(--color-text)] mb-1.5">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="block text-[10px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
          {hint}
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="block text-[11px] text-rose-600 dark:text-rose-400 mt-1 leading-relaxed font-medium"
        >
          {error}
        </span>
      )}
    </label>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Megaphone;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base inline-flex items-center gap-2 mb-1">
        <Icon size={14} className="text-purple-600 dark:text-purple-400" aria-hidden="true" />
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
