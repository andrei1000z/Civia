"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Trash2,
  Edit3,
  X,
  Save,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/Toast";

interface UpdateRow {
  id: string;
  version: string;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

interface DraftState {
  // null = creating new; string = editing existing id
  editingId: string | null;
  version: string;
  title: string;
  body: string;
  published_at: string; // ISO string for the input — defaults to now
}

const EMPTY_DRAFT: DraftState = {
  editingId: null,
  version: "",
  title: "",
  body: "",
  published_at: "",
};

function isoToInputDateTime(iso: string): string {
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in LOCAL
  // timezone. Strip the Z + ms.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputDateTimeToIso(local: string): string {
  if (!local) return "";
  // datetime-local has no timezone — interpret as local Date and emit ISO.
  return new Date(local).toISOString();
}

export default function AdminUpdatesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/admin/updateuri")
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    // Suggest the next version number (V<n+1>) based on the highest
    // existing numeric suffix. Author can override.
    const numbers = rows
      .map((r) => /^V?(\d+)/i.exec(r.version)?.[1])
      .filter((n): n is string => !!n)
      .map((n) => parseInt(n, 10));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    setDraft({
      editingId: null,
      version: `V${next}`,
      title: "",
      body: "",
      published_at: isoToInputDateTime(new Date().toISOString()),
    });
    setShowForm(true);
  };

  const openEdit = (row: UpdateRow) => {
    setDraft({
      editingId: row.id,
      version: row.version,
      title: row.title,
      body: row.body,
      published_at: isoToInputDateTime(row.published_at),
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    if (
      (draft.title || draft.body) &&
      !confirm("Renunți la modificări?")
    ) {
      return;
    }
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  };

  const save = async () => {
    if (!draft.version || !draft.title || draft.body.length < 10) {
      toast("Completează versiune, titlu și corp (min 10 caractere).", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        version: draft.version.trim(),
        title: draft.title.trim(),
        body: draft.body.trim(),
        ...(draft.published_at
          ? { published_at: inputDateTimeToIso(draft.published_at) }
          : {}),
      };
      const url = draft.editingId
        ? `/api/admin/updateuri/${draft.editingId}`
        : "/api/admin/updateuri";
      const method = draft.editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare salvare");
      // Update local list
      if (draft.editingId) {
        setRows((prev) =>
          prev.map((r) => (r.id === draft.editingId ? (j.data as UpdateRow) : r)),
        );
        toast(`Update ${j.data.version} actualizat.`, "success");
      } else {
        setRows((prev) =>
          [...prev, j.data as UpdateRow].sort(
            (a, b) =>
              new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
          ),
        );
        toast(`Update ${j.data.version} publicat.`, "success");
      }
      setDraft(EMPTY_DRAFT);
      setShowForm(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setSaving(false);
    }
  };

  const del = async (row: UpdateRow) => {
    if (
      !confirm(
        `Ștergi ${row.version} — „${row.title}"?\n\nAcțiunea nu poate fi anulată.`,
      )
    ) {
      return;
    }
    setDeleting(row.id);
    try {
      const res = await fetch(`/api/admin/updateuri/${row.id}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Eroare ștergere");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast(`${row.version} șters.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold inline-flex items-center gap-2">
            <Sparkles size={20} className="text-[var(--color-primary)]" />
            Update-uri platformă
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Versiunile publice listate la{" "}
            <Link
              href="/updateuri"
              target="_blank"
              className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5"
            >
              /updateuri <ExternalLink size={10} aria-hidden="true" />
            </Link>
            . Folosește **bold**, „- " pentru bullet-uri, „## " pentru subtitluri.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Plus size={14} aria-hidden="true" />
            Adaugă versiune
          </button>
        )}
      </div>

      {/* Inline create/edit form */}
      {showForm && (
        <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)]/40 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between gap-2 mb-5">
            <h2 className="font-[family-name:var(--font-sora)] font-bold text-base">
              {draft.editingId ? "Editează versiune" : "Versiune nouă"}
            </h2>
            <button
              type="button"
              onClick={cancelForm}
              className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg)] transition-colors"
              aria-label="Închide formularul"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid sm:grid-cols-[120px_1fr] gap-3 mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal sm:flex sm:items-center">
              Versiune
            </label>
            <input
              type="text"
              value={draft.version}
              onChange={(e) =>
                setDraft({ ...draft, version: e.target.value })
              }
              placeholder="V2"
              maxLength={20}
              className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] font-mono"
            />
          </div>

          <div className="grid sm:grid-cols-[120px_1fr] gap-3 mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal sm:flex sm:items-center">
              Titlu
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) =>
                setDraft({ ...draft, title: e.target.value })
              }
              placeholder='ex: "Hărți live cu calitatea aerului"'
              maxLength={140}
              className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>

          <div className="grid sm:grid-cols-[120px_1fr] gap-3 mb-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal sm:flex sm:items-center">
              Data
            </label>
            <input
              type="datetime-local"
              value={draft.published_at}
              onChange={(e) =>
                setDraft({ ...draft, published_at: e.target.value })
              }
              className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Conținut
            </label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder={`## Subtitlu

Paragraf descriptiv...

- Bullet 1
- Bullet 2 cu **bold** pentru cuvinte cheie

Mai mult text aici.`}
              rows={14}
              className="w-full p-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm font-mono leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] resize-y"
            />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Suport markdown light: <code>## Subtitlu</code>,{" "}
              <code>- bullet</code>, <code>**bold**</code>, paragrafe separate
              de linie goală.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg)] transition-colors"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              {saving ? (
                <Loader2 size={14} className="motion-safe:animate-spin" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {draft.editingId ? "Salvează" : "Publică"}
            </button>
          </div>
        </div>
      )}

      {/* Existing versions list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="motion-safe:animate-spin mx-auto mb-2" />
          Se încarcă versiunile…
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Nu există încă nicio versiune publicată.
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Plus size={14} aria-hidden="true" />
              Publică V1
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-mono text-[11px] font-bold">
                      {r.version}
                    </span>
                    <h3 className="font-[family-name:var(--font-sora)] font-bold text-base truncate">
                      {r.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                    Publicat:{" "}
                    {new Date(r.published_at).toLocaleString("ro-RO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Bucharest",
                    })}
                    {" · "}
                    {r.body.length} caractere
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    disabled={deleting === r.id || saving}
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)]/40 transition-colors disabled:opacity-50"
                    title="Editează"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => del(r)}
                    disabled={deleting === r.id || saving}
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-500/20 hover:border-rose-500/50 disabled:opacity-50 transition-colors"
                    title="Șterge"
                  >
                    {deleting === r.id ? (
                      <Loader2 size={14} className="motion-safe:animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
