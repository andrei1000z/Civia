"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  ImageIcon,
  Upload,
  X,
  Infinity as InfinityIcon,
  CheckCircle2,
} from "lucide-react";
import { createPetitie, type CreatePetitieState } from "@/actions/petitii-actions";
import { PETITIE_CATEGORII } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";
import { Button } from "@/components/ui/Button";

interface Props {
  userEmail: string | null;
}

const TARGETS = [
  { value: 500, label: "500", desc: "începător — local, focused" },
  { value: 1000, label: "1.000", desc: "mediu — județean / comunitar" },
  { value: 5000, label: "5.000", desc: "amplu — regional / national" },
  { value: 10000, label: "10.000", desc: "național — atrage atenția presei" },
  { value: 50000, label: "50.000", desc: "viral — necesită campanie activă" },
  { value: 100000, label: "100.000", desc: "masiv — referință națională" },
  // 0 = sentinel pentru NULL în DB („Nelimitat" — fără bară de progres
  // raportată la target; afișează doar contorul de semnături).
  { value: 0, label: "∞", desc: "fără limită — strânge cât poți" },
] as const;

const INITIAL: CreatePetitieState = { status: "idle" };

const DRAFT_KEY = "civia:petitie-initiaza:draft";

interface Draft {
  title: string;
  category: string;
  county_code: string;
  summary: string;
  body: string;
  target_signatures: string;
  image_url: string;
  addressee: string;
}

const EMPTY_DRAFT: Draft = {
  title: "",
  category: "",
  county_code: "",
  summary: "",
  body: "",
  target_signatures: "1000",
  image_url: "",
  addressee: "",
};

export function InitiatePetitieForm({ userEmail }: Props) {
  // useActionState e helper-ul nou Next 15+ pentru server actions cu state.
  // Înlocuiește vechiul useFormState (deprecated). Returnează tuple
  // [currentState, action, isPending].
  const [state, formAction] = useActionState(createPetitie, INITIAL);
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const fieldError = (k: string) => errors[k]?.[0] ?? null;

  // Draft autosave în localStorage — dacă userul reîncarcă pagina sau
  // închide tab-ul accidental, recuperăm completarea. Cleared după submit
  // de succes (server action redirect nu mai trece prin client, deci
  // ștergem optimist la submit-pending).
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const updateDraft = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate draft from localStorage ONCE at mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        setDraft({ ...EMPTY_DRAFT, ...parsed });
      }
    } catch { /* corrupt JSON or unavailable storage — ignore */ }
    setDraftLoaded(true);
  }, []);

  // Save draft on every change. Debounced via React's natural batch.
  useEffect(() => {
    if (!draftLoaded) return; // skip pe primul render înainte de hydrate
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* quota exceeded — silent */ }
  }, [draft, draftLoaded]);

  const clearDraft = () => {
    setDraft(EMPTY_DRAFT);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare upload");
      const url = j.data?.urls?.[0];
      if (!url) throw new Error("Nu am primit URL");
      updateDraft("image_url", url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Eroare upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    updateDraft("image_url", "");
    setUploadError(null);
  };

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // audit fix: la submit reușit server action face redirect() → codul
        // clientului se oprește, deci clearDraft() (doar din butonul „Șterge draft")
        // nu rulează niciodată → la următoarea vizită formularul „nou" e pre-populat
        // cu petiția deja trimisă. Ștergem localStorage la submit (NU și state-ul
        // React, ca formularul să-și păstreze datele dacă serverul respinge;
        // autosave-ul re-salvează dacă user-ul editează după o eroare).
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      }}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-3)] ring-1 ring-purple-500/5 p-6 md:p-8 space-y-10 md:space-y-12"
    >
      {/* Banner top — Logged-in + draft state. Wrapped într-un container
          cu border-bottom + padding clar ca să nu existe overlap cu prima
          secțiune (bug fix: înainte avea -mb-3 care trăgea section sus). */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-4 border-b border-[var(--color-border)] text-xs">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <span
            className="w-2 h-2 rounded-full bg-emerald-500 motion-safe:animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span>
            Conectat ca{" "}
            <span className="font-mono text-[var(--color-text)]">{userEmail ?? "anonim"}</span>
          </span>
        </div>
        {hasContentInDraft(draft) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Șterge complet ce-ai scris și începe de la zero?")) clearDraft();
            }}
            leftIcon={<X size={11} />}
          >
            Șterge draft
          </Button>
        )}
      </div>

      {/* SECTION 1 — Titlu (the hook) */}
      <Section title="Titlul petiției" icon={Megaphone}>
        <Field
          label="Titlu *"
          hint='Scurt, clar, ferm. Începe cu o cerere („Vrem ca...", „Cerem...", „Stop...").'
          error={fieldError("title")}
          counter={{ current: draft.title.length, max: 160, min: 10 }}
        >
          <input
            type="text"
            name="title"
            required
            maxLength={160}
            placeholder='Ex: „Vrem piste de bicicletă continue în Cluj-Napoca"'
            value={draft.title}
            onChange={(e) => updateDraft("title", e.target.value)}
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
              value={draft.category}
              onChange={(e) => updateDraft("category", e.target.value)}
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none z-10"
                aria-hidden="true"
              />
              <select
                name="county_code"
                value={draft.county_code}
                onChange={(e) => updateDraft("county_code", e.target.value)}
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

      {/* SECTION 2.5 — Adresant (către cine se adresează petiția) */}
      <Section title="Către cine te adresezi" icon={Megaphone}>
        <Field
          label="Adresant (opțional)"
          hint='Cui îi ceri să acționeze? Ex: „Primăria Cluj-Napoca", „Ministerul Educației", „Parlamentul României", „Consiliul Județean Timiș". Apare pe cardul petiției ca să știe cititorul cine ar trebui să răspundă.'
          error={fieldError("addressee")}
          counter={{ current: draft.addressee.length, max: 200 }}
        >
          <input
            type="text"
            name="addressee"
            maxLength={200}
            placeholder='Ex: „Primăria Municipiului București + Consiliul General"'
            value={draft.addressee}
            onChange={(e) => updateDraft("addressee", e.target.value)}
            className={inputCls(!!fieldError("addressee"))}
          />
        </Field>
      </Section>

      {/* SECTION 3 — Imagine cover (opțional) */}
      <Section title="Imagine cover (opțional)" icon={ImageIcon}>
        <input type="hidden" name="image_url" value={draft.image_url} />
        {draft.image_url ? (
          <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] group">
            <div className="relative aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.image_url}
                alt="Preview cover"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-xs)] bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-[var(--shadow-2)]">
                <CheckCircle2 size={11} aria-hidden="true" />
                Imagine atașată
              </span>
              <button
                type="button"
                onClick={removeImage}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-xs)] bg-black/60 text-white text-[10px] font-medium hover:bg-rose-600 backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              >
                <X size={11} />
                Elimină
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="
              w-full border-2 border-dashed border-[var(--color-border)]
              rounded-[var(--radius-md)] p-8 text-center
              hover:border-purple-500/50 hover:bg-purple-500/[0.03]
              transition-all duration-150
              flex flex-col items-center gap-2
              disabled:opacity-60 disabled:cursor-not-allowed
              focus:outline-none focus-visible:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-500/40
            "
          >
            {uploading ? (
              <Loader2 size={28} className="text-purple-600 dark:text-purple-400 motion-safe:animate-spin" />
            ) : (
              <Upload size={28} className="text-[var(--color-text-muted)]" />
            )}
            <p className="text-sm font-semibold mt-1">
              {uploading ? "Se încarcă..." : "Atașează imagine cover"}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed max-w-xs">
              JPG, PNG, WebP. Recomandat 1600×900 (16:9). Max 8 MB.
              Apare ca header pe pagina petiției + în share-uri sociale (Facebook, X, WhatsApp).
            </p>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadImage(f);
          }}
        />
        {uploadError && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-2 inline-flex items-start gap-1">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            {uploadError}
          </p>
        )}
        {fieldError("image_url") && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-2">
            {fieldError("image_url")}
          </p>
        )}
      </Section>

      {/* SECTION 4 — Sumar + body */}
      <Section title="Conținut" icon={FileText}>
        <Field
          label="Sumar pe scurt *"
          hint='Apare pe card-ul din /petitii și pe share-uri sociale. Răspunde la „despre ce e?" în 2 propoziții.'
          error={fieldError("summary")}
          counter={{ current: draft.summary.length, max: 280, min: 40 }}
        >
          <textarea
            name="summary"
            required
            minLength={40}
            maxLength={280}
            rows={3}
            placeholder='Ex: „Bicicliștii din Cluj sunt forțați să meargă pe trotuar sau pe carosabil din cauza pistelor fragmentate. Cerem un plan integrat de modernizare cu finalizare până în 2027."'
            value={draft.summary}
            onChange={(e) => updateDraft("summary", e.target.value)}
            className={`${inputCls(!!fieldError("summary"))} resize-y leading-relaxed h-auto py-2.5`}
          />
        </Field>

        <Field
          label="Descriere detaliată *"
          hint='Markdown light suportat: ## Subtitlu, **bold**, - bullet, paragrafe separate de linie goală.'
          error={fieldError("body")}
          counter={{ current: draft.body.length, max: 20000, min: 150 }}
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
            value={draft.body}
            onChange={(e) => updateDraft("body", e.target.value)}
            className={`${inputCls(!!fieldError("body"))} font-mono text-xs leading-relaxed resize-y h-auto py-2.5`}
          />
        </Field>
      </Section>

      {/* SECTION 5 — Target signatures */}
      <Section title="Target de semnături" icon={Target}>
        <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
          Câte semnături vrei să strângi? Bara de progres se calculează raportat la ținta
          asta. Alege realist — un target prea mare descurajează semnatarii când văd 2%.
          Alege <strong>∞ Nelimitat</strong> dacă vrei doar contor (fără bară), util pentru
          campanii open-ended.
        </p>
        <fieldset className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5" aria-label="Target semnături">
          {TARGETS.map((t) => {
            const isUnlimited = t.value === 0;
            return (
              <label
                key={t.value}
                className={`
                  group cursor-pointer relative
                  bg-[var(--color-bg)]
                  border-2 border-[var(--color-border)]
                  rounded-[var(--radius-md)]
                  p-3.5 text-center
                  transition-all duration-200
                  hover:border-purple-500/50 hover:bg-purple-500/[0.03]
                  hover:scale-[1.02] hover:shadow-[var(--shadow-1)]
                  has-[:checked]:border-purple-500
                  has-[:checked]:bg-gradient-to-br has-[:checked]:from-purple-500/15 has-[:checked]:to-indigo-500/5
                  has-[:checked]:shadow-[0_4px_16px_-4px_rgba(168,85,247,0.4)]
                  has-[:checked]:scale-[1.02]
                  has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-purple-500/60 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--color-surface)]
                  motion-reduce:hover:scale-100 motion-reduce:has-[:checked]:scale-100
                  ${isUnlimited ? "ring-1 ring-purple-500/20" : ""}
                `}
              >
                <input
                  type="radio"
                  name="target_signatures"
                  value={t.value}
                  checked={draft.target_signatures === String(t.value)}
                  onChange={(e) => updateDraft("target_signatures", e.target.value)}
                  className="sr-only peer"
                  required
                />
                <span
                  aria-hidden="true"
                  className="
                    absolute top-1.5 right-1.5
                    w-5 h-5 rounded-full
                    bg-purple-500 text-white
                    text-[10px] font-bold
                    grid place-items-center
                    shadow-[var(--shadow-2)]
                    opacity-0 scale-50
                    peer-checked:opacity-100 peer-checked:scale-100
                    transition-all duration-200
                  "
                >
                  ✓
                </span>
                {isUnlimited ? (
                  <div className="font-[family-name:var(--font-sora)] font-extrabold text-2xl text-purple-600 dark:text-purple-400 leading-none mt-0.5 mb-0.5">
                    <InfinityIcon size={28} className="mx-auto" />
                  </div>
                ) : (
                  <div className="font-[family-name:var(--font-sora)] font-extrabold text-lg md:text-xl text-[var(--color-text)] tabular-nums tracking-tight">
                    {t.label}
                  </div>
                )}
                <div className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-1 peer-checked:text-purple-600 peer-checked:dark:text-purple-300 peer-checked:font-medium transition-colors">
                  {t.desc}
                </div>
              </label>
            );
          })}
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
    <Button
      type="submit"
      variant="petition"
      size="md"
      loading={pending}
      aria-busy={pending}
      leftIcon={<Send size={14} aria-hidden="true" />}
      rightIcon={<Sparkles size={12} className="opacity-70" aria-hidden="true" />}
    >
      {pending ? "Se trimite spre verificare..." : "Trimite spre verificare"}
    </Button>
  );
}

// ============================================================
// Reusable form primitives
// ============================================================

const inputCls = (hasError: boolean) =>
  `w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border text-sm
   transition-all duration-150
   placeholder:text-[var(--color-text-muted)]
   hover:border-[var(--color-text-muted)]/40
   focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500
   focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:border-purple-500
   ${
     hasError
       ? "border-rose-500 dark:border-rose-400 focus:ring-rose-500/60 focus:border-rose-500"
       : "border-[var(--color-border)]"
   }`;

function Field({
  label,
  hint,
  error,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  /** Live char counter sub label. Devine roșu dacă e sub min sau peste max. */
  counter?: { current: number; min?: number; max: number };
  children: React.ReactNode;
}) {
  const counterStyle = counter
    ? counter.current > counter.max
      ? "text-rose-600 dark:text-rose-400 font-bold"
      : counter.min && counter.current > 0 && counter.current < counter.min
        ? "text-amber-600 dark:text-amber-400 font-medium"
        : counter.current >= counter.max * 0.9
          ? "text-amber-600 dark:text-amber-400 font-medium"
          : "text-[var(--color-text-muted)]"
    : "";
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-[var(--color-text)]">{label}</span>
        {counter && (
          <span
            className={`text-[10px] tabular-nums transition-colors ${counterStyle}`}
            aria-live="polite"
          >
            {counter.current.toLocaleString("ro-RO")} / {counter.max.toLocaleString("ro-RO")}
            {counter.min && counter.current < counter.min && (
              <span className="ml-1 opacity-70">(min {counter.min})</span>
            )}
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <span className="block text-[11px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed pl-0.5">
          {hint}
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="flex items-start gap-1 text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 leading-relaxed font-medium pl-0.5"
        >
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </span>
      )}
    </label>
  );
}

/** True dacă există măcar un câmp completat (ne-default) — folosit ca să
 *  arătăm „Șterge draft" doar când are sens. */
function hasContentInDraft(d: Draft): boolean {
  return !!(
    d.title.trim() ||
    d.summary.trim() ||
    d.body.trim() ||
    d.image_url ||
    d.category ||
    d.county_code ||
    (d.target_signatures && d.target_signatures !== "1000")
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
    <fieldset className="space-y-4">
      {/* Header secțiune cu icon-chip mai prominent + numerotare implicită
          via flex. mb-2 explicit (nu doar space-y de la parent) ca să fie
          clar că header-ul e detașat de primul câmp. */}
      <legend className="font-[family-name:var(--font-sora)] font-bold text-sm md:text-base inline-flex items-center gap-2.5 mb-2 w-full">
        <span
          className="w-7 h-7 rounded-[var(--radius-xs)] bg-purple-500/10 grid place-items-center shrink-0"
          aria-hidden="true"
        >
          <Icon size={14} className="text-purple-600 dark:text-purple-400" />
        </span>
        <span>{title}</span>
      </legend>
      {children}
    </fieldset>
  );
}
