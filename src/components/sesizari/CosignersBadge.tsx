"use client";

import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";

interface Props {
  code: string;
}

interface CosignersData {
  count: number;
  recent: Array<{ name: string; city: string | null; created_at: string }>;
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
        <ul className="mt-2 space-y-1 text-xs text-[var(--color-text-muted)]">
          {data.recent.map((r, i) => (
            <li key={i} className="inline-flex items-center gap-1.5 mr-3">
              <span className="font-medium text-[var(--color-text)]">{r.name}</span>
              {r.city && <span>· {r.city}</span>}
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
