"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, Plus, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import {
  type ActualizareCategorie,
  type ActualizareSchimbare,
  CATEGORIE_META,
} from "@/data/actualizari";
import { ALL_CATEGORII } from "@/lib/actualizari/repository";

interface Props {
  /** Pentru edit — datele inițiale */
  initial?: {
    versiune: string;
    data: string;
    titlu: string;
    descriere: string | null;
    schimbari: ActualizareSchimbare[];
    major: boolean;
    minimalist: boolean;
    continut_markdown: string | null;
    published: boolean;
  };
}

/**
 * Convertește ISO datetime la format pentru `<input type="datetime-local">`.
 * Input cere format: "YYYY-MM-DDTHH:mm" (fără secunde, fără timezone).
 */
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Manual format ca să luăm local time, nu UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function ActualizareForm({ initial }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;

  const [versiune, setVersiune] = useState(initial?.versiune ?? "");
  const [dataLocal, setDataLocal] = useState(
    initial ? isoToLocal(initial.data) : isoToLocal(new Date().toISOString()),
  );
  const [titlu, setTitlu] = useState(initial?.titlu ?? "");
  const [descriere, setDescriere] = useState(initial?.descriere ?? "");
  const [major, setMajor] = useState(initial?.major ?? false);
  const [minimalist, setMinimalist] = useState(initial?.minimalist ?? false);
  const [continutMarkdown, setContinutMarkdown] = useState(initial?.continut_markdown ?? "");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [schimbari, setSchimbari] = useState<ActualizareSchimbare[]>(
    initial?.schimbari ?? [],
  );

  function addSchimbare() {
    setSchimbari((s) => [...s, { categorie: "feature", text: "" }]);
  }
  function updateSchimbare(i: number, patch: Partial<ActualizareSchimbare>) {
    setSchimbari((s) => s.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeSchimbare(i: number) {
    setSchimbari((s) => s.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d+\.\d+\.\d+$/.test(versiune)) {
      setError("Versiunea trebuie în format X.Y.Z (semver, ex: 0.1.0)");
      return;
    }
    if (titlu.trim().length < 1) {
      setError("Titlul e obligatoriu");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        versiune,
        data: localToIso(dataLocal),
        titlu: titlu.trim(),
        descriere: descriere.trim() || null,
        schimbari: schimbari.filter((s) => s.text.trim().length > 0),
        major,
        minimalist,
        continut_markdown: continutMarkdown.trim() || null,
        published,
      };
      const url = isEdit
        ? `/api/admin/actualizari/${initial!.versiune}`
        : "/api/admin/actualizari";
      const method = isEdit ? "PATCH" : "POST";
      // Pentru PATCH, nu trimitem `versiune` (nu poate fi schimbat)
      const body = isEdit
        ? (() => {
            const { versiune: _v, ...rest } = payload;
            void _v;
            return rest;
          })()
        : payload;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Eroare salvare");
        setSubmitting(false);
        return;
      }
      router.push("/admin/actualizari");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare rețea");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/admin/actualizari"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] mb-2"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Înapoi la listă
          </Link>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold">
            {isEdit ? `Editează v${initial?.versiune}` : "Adaugă versiune nouă"}
          </h1>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Se salvează...
            </>
          ) : (
            <>
              <Save size={16} aria-hidden="true" />
              {isEdit ? "Salvează modificările" : "Creează versiune"}
            </>
          )}
        </button>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-[var(--radius-md)] p-3 text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {/* Metadata grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Versiune (semver) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={versiune}
            onChange={(e) => setVersiune(e.target.value)}
            placeholder="0.1.0"
            required
            readOnly={isEdit}
            className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50 read-only:opacity-50 read-only:cursor-not-allowed"
          />
          {isEdit && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Versiunea NU poate fi schimbată după creare.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Data + oră release <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={dataLocal}
            onChange={(e) => setDataLocal(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Titlu <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={titlu}
          onChange={(e) => setTitlu(e.target.value)}
          placeholder="Ex: Civia se naște / Notificări native Android / etc."
          required
          className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Descriere scurtă (opțional, Markdown)
        </label>
        <MarkdownEditor
          value={descriere}
          onChange={setDescriere}
          placeholder="1-2 propoziții pentru context. Suportă **bold**, *italic*, etc."
          rows={4}
        />
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={major}
            onChange={(e) => setMajor(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm">
            <strong>Release major</strong> — afișează badge violet pe pagină
          </span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={minimalist}
            onChange={(e) => setMinimalist(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm">
            <strong>Render minimalist</strong> — card centrat + Markdown jos (no schimbări list)
          </span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm">
            <strong>Publicat</strong> — vizibil pe /actualizari. Untick = draft.
          </span>
        </label>
      </div>

      {/* Conținut Markdown (pentru minimalist) */}
      {minimalist && (
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Conținut Markdown lung (pentru render minimalist)
          </label>
          <MarkdownEditor
            value={continutMarkdown}
            onChange={setContinutMarkdown}
            placeholder="Conținut detaliat în Markdown. Folosește toolbar-ul pentru bold, italic, culori, mărimi, etc."
            rows={16}
          />
        </div>
      )}

      {/* Schimbări list (pentru render standard) */}
      {!minimalist && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium">
              Schimbări ({schimbari.length})
            </label>
            <button
              type="button"
              onClick={addSchimbare}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Plus size={12} aria-hidden="true" />
              Adaugă schimbare
            </button>
          </div>
          <div className="space-y-2">
            {schimbari.map((s, i) => (
              <div
                key={i}
                className="flex gap-2 items-start bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-3"
              >
                <select
                  value={s.categorie}
                  onChange={(e) =>
                    updateSchimbare(i, { categorie: e.target.value as ActualizareCategorie })
                  }
                  className="h-9 px-2 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold shrink-0"
                  style={{
                    color: CATEGORIE_META[s.categorie].color,
                  }}
                >
                  {ALL_CATEGORII.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIE_META[c].label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={s.text}
                  onChange={(e) => updateSchimbare(i, { text: e.target.value })}
                  placeholder="Descrierea schimbării (suportă **bold**, *italic*, etc.)"
                  className="flex-1 h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={() => removeSchimbare(i)}
                  className="h-9 px-2 rounded-[var(--radius-xs)] text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Șterge"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            {schimbari.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] italic text-center py-4">
                Nicio schimbare adăugată. Apasă „Adaugă schimbare" sus.
              </p>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
