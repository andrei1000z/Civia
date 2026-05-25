"use client";

import { useState } from "react";
import { Check, X, AlertCircle, Copy, Mail, Image as ImgIcon } from "lucide-react";
import { useToast } from "@/components/Toast";

interface Row {
  id: string;
  text: string;
  image_url: string | null;
  email: string | null;
  ip_hash: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

function statusStyles(status: string) {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "duplicate":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }
}

export function IntreruperiSubmissions({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [acting, setActing] = useState<string | null>(null);
  const { toast } = useToast();

  const updateStatus = async (id: string, status: Row["status"]) => {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/intreruperi/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Eroare");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast("Status actualizat", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setActing(null);
    }
  };

  // 2026-05-25 — filter chips scoase la cererea user-ului.
  const filtered = rows;

  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 tabular-nums">
        {rows.length} {rows.length === 1 ? "submisie" : "submisii"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-center text-[var(--color-text-muted)] py-16 text-sm">
          Nicio submisie.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <article
              key={r.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5"
            >
              <header className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusStyles(r.status)}`}
                  >
                    {r.status}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {r.id.slice(0, 8)}
                  </span>
                  <time
                    dateTime={r.created_at}
                    className="text-xs text-[var(--color-text-muted)]"
                    suppressHydrationWarning
                  >
                    {new Date(r.created_at).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}
                  </time>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(r.text);
                      toast("Text copiat", "success", 1500);
                    } catch {
                      toast("Browser-ul nu permite copierea — selectează manual", "error");
                    }
                  }}
                  aria-label="Copiază textul submisiei"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors p-1 -m-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  <Copy size={14} aria-hidden="true" />
                </button>
              </header>

              <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">
                {r.text}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)] mb-4">
                {r.image_url && (
                  <a
                    href={r.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                  >
                    <ImgIcon size={12} aria-hidden="true" /> Vezi poza
                  </a>
                )}
                {r.email && (
                  <a
                    href={`mailto:${r.email}?subject=${encodeURIComponent(
                      `Re: Întrerupere raportată Civia (${r.id.slice(0, 8)})`,
                    )}&body=${encodeURIComponent(
                      `Salut,\n\nMulțumim că ai raportat întreruperea:\n\n> ${r.text
                        .split("\n")
                        .join("\n> ")}\n\n---\nDespre situație:\n\n`,
                    )}`}
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                  >
                    <Mail size={12} aria-hidden="true" /> {r.email}
                  </a>
                )}
                <span className="font-mono text-[10px] opacity-60">
                  IP: {r.ip_hash.slice(0, 10)}…
                </span>
              </div>

              {r.status === "pending" && (
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border)] flex-wrap">
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "published")}
                    disabled={acting === r.id}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-xs)] bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  >
                    <Check size={13} aria-hidden="true" /> Publică
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "rejected")}
                    disabled={acting === r.id}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-xs)] bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                  >
                    <X size={13} aria-hidden="true" /> Respinge
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "duplicate")}
                    disabled={acting === r.id}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    <AlertCircle size={13} aria-hidden="true" /> Duplicat
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
