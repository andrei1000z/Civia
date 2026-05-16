"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  use_case: string;
  scopes: string[];
  tier: string;
  revoked_at: string | null;
  last_used_at: string | null;
  request_count: number;
  created_at: string;
}

export function ApiKeysManager() {
  const { user, openAuthModal } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [useCase, setUseCase] = useState<"journalism" | "research" | "ngo" | "civic-tech">("civic-tech");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetch("/api/developer/keys", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setKeys(j.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  async function createKey() {
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, contact_email: contactEmail, use_case: useCase }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Eroare");
      setNewKey(j.key);
      setKeys((prev) => [j.meta as ApiKey, ...prev]);
      setLabel("");
      setContactEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Sigur revoci aceasta cheie? Apelurile vor incepe sa esueze imediat.")) return;
    await fetch(`/api/developer/keys?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k));
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!user) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
        <Key size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" aria-hidden="true" />
        <p className="text-sm mb-3">Loghează-te ca să generezi chei API.</p>
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Loghează-te
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-[var(--color-text-muted)]">Se incarca...</div>;
  }

  return (
    <div className="space-y-4">
      {newKey && (
        <div className="rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
            ⚠️ Salvează cheia ACUM — nu o vei mai vedea niciodată
          </p>
          <div className="flex items-center gap-2 bg-[var(--color-bg)] border border-amber-300 dark:border-amber-700 rounded px-3 py-2 mb-2">
            <code className="text-xs flex-1 overflow-x-auto break-all">{newKey}</code>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:underline"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiat" : "Copiază"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="text-xs underline text-amber-900 dark:text-amber-200"
          >
            Am salvat-o, închide
          </button>
        </div>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Generează cheie nouă
        </button>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Etichetă (ce o folosești pentru?)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: dashboard Recorder.ro"
              className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Email contact
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@..."
              className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Caz de utilizare
            </label>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value as typeof useCase)}
              className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <option value="civic-tech">Civic-tech</option>
              <option value="journalism">Jurnalism</option>
              <option value="research">Research / academic</option>
              <option value="ngo">ONG</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createKey}
              disabled={creating || label.length < 3 || !contactEmail.includes("@")}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating && <Loader2 size={12} className="animate-spin" />}
              Generează
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
            >
              Renunță
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Nu ai chei generate încă.</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 flex items-center gap-3 ${
                k.revoked_at ? "opacity-50" : ""
              }`}
            >
              <Key size={14} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{k.label}</span>
                  {k.revoked_at && (
                    <span className="inline-block bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-bold px-2 py-0.5 rounded">
                      REVOCATĂ
                    </span>
                  )}
                </div>
                <code className="text-[11px] text-[var(--color-text-muted)] block truncate">
                  {k.key_prefix}…
                </code>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {k.use_case} · tier {k.tier} · {k.request_count} apeluri
                </div>
              </div>
              {!k.revoked_at && (
                <button
                  type="button"
                  onClick={() => revokeKey(k.id)}
                  className="shrink-0 p-2 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Revocă"
                  aria-label="Revocă cheia"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
