"use client";

import { useCallback, useEffect, useState } from "react";
import { ThumbsUp, Plus, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface Propunere {
  id: string;
  county: string;
  titlu: string;
  descriere: string;
  categorie: string;
  votes_count: number;
  created_at: string;
}

const CATEGORII: Array<{ value: string; label: string }> = [
  { value: "mobilitate", label: "🚲 Mobilitate" },
  { value: "spatii-verzi", label: "🌳 Spații verzi" },
  { value: "siguranta", label: "🦺 Siguranță" },
  { value: "educatie", label: "🏫 Educație" },
  { value: "sanatate", label: "🏥 Sănătate" },
  { value: "altele", label: "📌 Altele" },
];

const ORASE: Array<{ county: string; label: string }> = [
  { county: "B", label: "București" },
  { county: "CJ", label: "Cluj" },
  { county: "IS", label: "Iași" },
  { county: "TM", label: "Timiș" },
  { county: "CT", label: "Constanța" },
  { county: "BV", label: "Brașov" },
];

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition";

export function PrioritatiOras() {
  const [county, setCounty] = useState("B");
  const [rows, setRows] = useState<Propunere[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [titlu, setTitlu] = useState("");
  const [descriere, setDescriere] = useState("");
  const [categorie, setCategorie] = useState("altele");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bp/propuneri?county=${county}`);
      const json = await res.json();
      setRows(json.data ?? []);
      setMyVotes(new Set(json.myVotes ?? []));
    } catch {
      setError("Nu am putut încărca lista.");
    } finally {
      setLoading(false);
    }
  }, [county]);

  useEffect(() => {
    void load();
  }, [load]);

  const vote = async (id: string) => {
    setError(null);
    setNeedsLogin(false);
    const res = await fetch("/api/bp/vot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propunereId: id }),
    });
    if (res.status === 401) {
      setNeedsLogin(true);
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Eroare");
      return;
    }
    // Optimist: actualizează local fără refetch complet.
    setRows((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, votes_count: p.votes_count + (json.voted ? 1 : -1) } : p))
        .sort((a, b) => b.votes_count - a.votes_count),
    );
    setMyVotes((prev) => {
      const next = new Set(prev);
      if (json.voted) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/bp/propuneri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ county, titlu, descriere, categorie }),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Eroare");
        return;
      }
      setSubmitted(true);
      setTitlu("");
      setDescriere("");
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Selector oraș */}
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Alege orașul">
        {ORASE.map((o) => (
          <button
            key={o.county}
            type="button"
            onClick={() => setCounty(o.county)}
            aria-pressed={county === o.county}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition ${
              county === o.county
                ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-1)]"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {needsLogin && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/25 px-4 py-3 text-sm">
          <Link href="/setari" className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] underline">
            <LogIn size={14} aria-hidden="true" />
            Intră în cont (magic-link, fără parolă)
          </Link>{" "}
          ca să propui sau să votezi — un vot de om, nu de robot.
        </div>
      )}
      {error && (
        <p className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {submitted && (
        <p className="mb-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400" role="status">
          Propunerea ta e publică. Strânge voturi — topul orașului se transmite formal primăriei.
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-text-muted)]">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Se încarcă…
        </div>
      ) : rows.length > 0 ? (
        <ol className="space-y-2.5 stagger-children">
          {rows.map((p, i) => {
            const voted = myVotes.has(p.id);
            return (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)]"
              >
                <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-extrabold tabular-nums text-[var(--color-text-muted)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-[var(--color-text)]">{p.titlu}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{p.descriere}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {CATEGORII.find((c) => c.value === p.categorie)?.label ?? p.categorie}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => vote(p.id)}
                  aria-pressed={voted}
                  className={`btn-press inline-flex shrink-0 flex-col items-center gap-0.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-bold transition ${
                    voted
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                  }`}
                  title={voted ? "Retrage votul" : "Votează prioritatea"}
                >
                  <ThumbsUp size={14} aria-hidden="true" />
                  <span className="tabular-nums">{p.votes_count}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Nicio prioritate propusă încă pentru acest oraș. Fii primul — propune mai jos.
        </div>
      )}

      {/* Propune */}
      <div className="mt-4">
        {!showForm ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowForm(true)}
            leftIcon={<Plus size={15} aria-hidden="true" />}
          >
            Propune o prioritate
          </Button>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-1)] space-y-3">
            <div>
              <label htmlFor="bp-titlu" className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">
                Ce ar trebui să finanțeze orașul? (titlu scurt)
              </label>
              <input
                id="bp-titlu"
                className={inputCls}
                value={titlu}
                onChange={(e) => setTitlu(e.target.value)}
                maxLength={120}
                placeholder="ex: Piste de biciclete pe Bd. Basarabia"
              />
            </div>
            <div>
              <label htmlFor="bp-desc" className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">
                De ce contează (20-1000 caractere)
              </label>
              <textarea
                id="bp-desc"
                className={`${inputCls} min-h-[80px] resize-y`}
                value={descriere}
                onChange={(e) => setDescriere(e.target.value)}
                maxLength={1000}
                placeholder="Descrie concret nevoia și cine ar beneficia…"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorie">
              {CATEGORII.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategorie(c.value)}
                  aria-pressed={categorie === c.value}
                  className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold transition ${
                    categorie === c.value
                      ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                      : "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={submitting || titlu.trim().length < 8 || descriere.trim().length < 20}
                loading={submitting}
              >
                Publică propunerea
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Renunță
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
