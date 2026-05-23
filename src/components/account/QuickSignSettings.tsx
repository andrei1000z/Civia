"use client";

import { useState, useEffect, useRef } from "react";
import {
  Megaphone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Info,
  Bookmark,
  MousePointerClick,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { DECLIC_COUNTIES } from "@/lib/petitii/declic-prefill";
import { buildDeclicBookmarklet } from "@/lib/petitii/declic-bookmarklet";

interface QuickSignForm {
  firstName: string;
  lastName: string;
  email: string;
  county: string;
  phone: string;
  enabled: boolean;
}

const EMPTY: QuickSignForm = {
  firstName: "",
  lastName: "",
  email: "",
  county: "",
  phone: "",
  enabled: false,
};

/**
 * /cont „Semnare rapidă petiții" — user introduce datele 1 dată, le folosim
 * să construim URL-ul Declic prefilled la fiecare petiție. NU semnăm noi
 * în numele user-ului (vezi eIDAS + ToS Declic) — doar reducem fricțiunea.
 */
export function QuickSignSettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<QuickSignForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef<string>("");

  useEffect(() => {
    fetch("/api/profile/quick-sign", { method: "GET" })
      .then((r) => (r.ok ? r.json() : { data: EMPTY }))
      .then((j) => {
        const data = j?.data ?? null;
        if (data) {
          const next: QuickSignForm = {
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
            email: data.email ?? "",
            county: data.county ?? "",
            phone: data.phone ?? "",
            enabled: data.enabled === true,
          };
          setForm(next);
          initialRef.current = JSON.stringify(next);
        }
      })
      .catch(() => {/* leave empty */})
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: QuickSignForm) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/quick-sign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: next.firstName.trim() || null,
          lastName: next.lastName.trim() || null,
          email: next.email.trim() || null,
          county: next.county || null,
          phone: next.phone.trim() || null,
          enabled: next.enabled,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Eroare salvare");
      setSavedAt(Date.now());
      initialRef.current = JSON.stringify(next);
      toast("Datele pentru semnare rapidă au fost salvate", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    const next = { ...form, enabled };
    setForm(next);
    save(next);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await save(form);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Încarc setările...
      </div>
    );
  }

  const dirty = JSON.stringify(form) !== initialRef.current;
  const hasMinimum =
    form.firstName.trim() && form.lastName.trim() && form.email.trim();

  return (
    <form onSubmit={handleSubmitForm} className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-[var(--radius-xs)] bg-purple-500/10 border border-purple-500/30 text-xs leading-relaxed">
        <Info
          size={14}
          className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold mb-0.5 text-[var(--color-text)]">
            Cum funcționează
          </p>
          <p className="text-[var(--color-text-muted)]">
            Civia construiește un link pre-completat către Declic. Tu dai{" "}
            <strong>un singur click</strong> la „Semnează" pe site-ul Declic
            (cerință legală — semnătura electronică e actul tău, nu al
            nostru). Datele nu părăsesc Civia decât în momentul în care tu
            deschizi link-ul.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
            Prenume <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) =>
              setForm({ ...form, firstName: e.target.value.slice(0, 50) })
            }
            maxLength={50}
            autoComplete="given-name"
            placeholder="Andrei"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
            Nume <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) =>
              setForm({ ...form, lastName: e.target.value.slice(0, 50) })
            }
            maxLength={50}
            autoComplete="family-name"
            placeholder="Popescu"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
          Email <span className="text-red-500">*</span>
        </span>
        <input
          type="email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value.slice(0, 254) })
          }
          maxLength={254}
          autoComplete="email"
          placeholder="andrei@example.com"
          className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
            Județ
          </span>
          <select
            value={form.county}
            onChange={(e) => setForm({ ...form, county: e.target.value })}
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <option value="">— Alege —</option>
            {DECLIC_COUNTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
            Telefon (opțional)
          </span>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value.slice(0, 30) })
            }
            maxLength={30}
            autoComplete="tel"
            placeholder="+40 7XX XXX XXX"
            className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-[var(--radius-xs)] bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <label
        className={`flex items-start gap-3 p-3 rounded-[var(--radius-xs)] border cursor-pointer transition-colors ${
          form.enabled
            ? "bg-purple-500/10 border-purple-500/40"
            : "bg-[var(--color-surface-2)] border-[var(--color-border)]"
        } ${!hasMinimum ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          type="checkbox"
          checked={form.enabled}
          disabled={!hasMinimum}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-purple-600"
        />
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <Megaphone
              size={14}
              className="text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
            <strong>Activează semnarea rapidă pentru petiții</strong>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
            {hasMinimum
              ? `Când apare o petiție nouă, butonul „Semnează” deschide direct site-ul Declic cu datele tale pre-completate. Tu mai dai 1 click și gata.`
              : `Completează minim prenume, nume și email ca să poți activa.`}
          </p>
        </div>
      </label>

      {/* Bookmarklet drag-to-bar — apare doar când user are minimum data + enabled.
          Declic NU citește URL params (verified live 5/23/2026 — formularul rămâne
          gol cu params în URL). Singura cale legală de auto-fill e un user-script:
          un mic JS pe care user-ul îl trage 1 dată în bookmark bar, apoi pe orice
          pagină Declic îl click-ează → fill instant.
          E 100% controlat de user (asemenea unui password manager), respectă
          eIDAS — click-ul final de „Semnează" tot a user-ului rămâne. */}
      {form.enabled && hasMinimum && (
        <BookmarkletPanel
          firstName={form.firstName}
          lastName={form.lastName}
          email={form.email}
          county={form.county}
          phone={form.phone}
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[var(--radius-button)] bg-purple-600 hover:bg-purple-700 active:scale-[0.97] text-white text-sm font-semibold transition-all shadow-[var(--shadow-2)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} aria-hidden="true" />
          )}
          Salvează datele
        </button>
        {savedAt && !dirty && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 size={12} aria-hidden="true" />
            Salvat
          </span>
        )}
      </div>
    </form>
  );
}

interface BookmarkletProps {
  firstName: string;
  lastName: string;
  email: string;
  county: string;
  phone: string;
}

function BookmarkletPanel({
  firstName,
  lastName,
  email,
  county,
  phone,
}: BookmarkletProps) {
  // Generăm bookmarklet-ul cu datele inline. Re-generăm la fiecare change
  // (de-bounced via useMemo dacă devine slow, dar e cheap — JSON.stringify).
  const href = buildDeclicBookmarklet({
    firstName,
    lastName,
    email,
    county: county || null,
    phone: phone || null,
  });

  return (
    <div className="p-4 rounded-[var(--radius-md)] bg-gradient-to-br from-emerald-500/10 via-[var(--color-surface)] to-cyan-500/10 border border-emerald-500/30 space-y-3">
      <div className="flex items-start gap-2">
        <Bookmark
          size={16}
          className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-sora)] font-bold text-sm">
            Activează completarea automată pe Declic
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
            Trage butonul de mai jos în <strong>bara de favorite</strong> a
            browser-ului. La fiecare petiție Declic, dă click pe el și formularul
            se completează singur. <strong>Setezi 1 dată, folosești de zeci de ori.</strong>
          </p>
        </div>
      </div>

      <a
        href={href}
        // Empêchons accidental navigation if user clicks. The bookmarklet is
        // meant to be DRAGGED to the bookmark bar, not clicked here.
        onClick={(e) => {
          e.preventDefault();
          alert(
            "Trage butonul cu mouse-ul în bara de favorite a browser-ului (de obicei sub URL). Apoi pe orice pagină Declic, dă click pe el și formularul se va completa automat.",
          );
        }}
        draggable
        title="Trage acest buton în bara de favorite"
        className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[var(--radius-button)] bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-sm font-bold shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)] cursor-grab active:cursor-grabbing select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <MousePointerClick size={14} aria-hidden="true" />
        Civia: completează automat
      </a>

      <details className="text-xs text-[var(--color-text-muted)]">
        <summary className="cursor-pointer hover:text-[var(--color-text)] transition-colors font-medium">
          Cum funcționează?
        </summary>
        <ol className="mt-2 ml-4 space-y-1 list-decimal leading-relaxed">
          <li>
            Asigură-te că <strong>bara de favorite e vizibilă</strong> (în Chrome:{" "}
            <code className="px-1 rounded bg-[var(--color-surface-2)]">
              Ctrl+Shift+B
            </code>
            ).
          </li>
          <li>
            <strong>Trage</strong> butonul verde de mai sus cu mouse-ul în bara de
            favorite — apare ca un bookmark numit „Civia: completează automat".
          </li>
          <li>
            Pe orice pagină Declic, <strong>click pe bookmark</strong> → formularul
            se completează automat cu datele tale.
          </li>
          <li>
            Tu apeși „Semnează" pe site-ul Declic (cerință legală — semnătura
            rămâne actul tău, nu al Civia).
          </li>
        </ol>
        <p className="mt-2 italic">
          De ce un bookmark? Declic nu permite completarea formularului din afara
          sistemului lor. Bookmarklet-ul rulează în browser-ul tău, sub controlul
          tău — 100% legal și sigur (asemenea unui password manager).
        </p>
      </details>
    </div>
  );
}
