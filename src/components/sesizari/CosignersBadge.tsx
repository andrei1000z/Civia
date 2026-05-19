"use client";

import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";

interface Props {
  code: string;
}

interface CosignersData {
  count: number;
  /**
   * PRIVACY: API-ul returneaza DOAR first_name + created_at. Nu mai
   * primim niciodata nume complet sau adresa (fix bug leak 5/19/2026).
   */
  recent: Array<{ first_name: string; created_at: string }>;
}

/**
 * Format data scurt: „19 mai", „4 iun". Folosit pe linia de cosigners
 * sub badge-ul de count. Ro locale, timezone Europe/Bucharest pentru
 * consistenta server (UTC) ↔ client (local).
 */
function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Bucharest",
    });
  } catch {
    return "";
  }
}

export function CosignersBadge({ code }: Props) {
  const [data, setData] = useState<CosignersData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sesizari/${code}/cosign`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: CosignersData | null) => {
        if (!cancelled && j) setData(j);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [code]);

  if (!data || data.count === 0) return null;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] text-xs font-semibold hover:brightness-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-expanded={open}
        aria-label={`${data.count} cetateni au co-semnat aceasta sesizare`}
      >
        <UserCheck size={14} aria-hidden="true" />
        {data.count === 1
          ? "1 cetățean a co-semnat"
          : `${data.count} cetățeni au co-semnat`}
      </button>
      {open && data.recent.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
          {data.recent.map((r, i) => (
            <li key={i} className="inline-flex items-center gap-1.5">
              <span className="font-medium text-[var(--color-text)]">{r.first_name}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={r.created_at}>{formatShortDate(r.created_at)}</time>
            </li>
          ))}
          {data.count > data.recent.length && (
            <li className="text-[10px] italic">
              ...și încă {data.count - data.recent.length}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
