"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Download } from "lucide-react";
import type { Interruption } from "@/data/intreruperi";
import { toGoogleCalendarUrl, toOutlookCalendarUrl } from "@/data/intreruperi";

export function CalendarMenu({ item }: { item: Interruption }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
      >
        <Calendar size={14} /> Adaugă în calendar
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-20 top-full mt-2 right-0 left-0 lc-nav-glass rounded-2xl overflow-hidden"
        >
          <a
            href={toGoogleCalendarUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 h-10 text-xs font-medium hover:bg-[var(--color-bg)] transition-colors"
            role="menuitem"
          >
            <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-blue-500 text-white text-[10px] font-bold">
              G
            </span>
            Google Calendar
          </a>
          <a
            href={toOutlookCalendarUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 h-10 text-xs font-medium hover:bg-[var(--color-bg)] transition-colors"
            role="menuitem"
          >
            <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-sky-600 text-white text-[10px] font-bold">
              O
            </span>
            Outlook / Live
          </a>
          <a
            href={`/api/intreruperi/${item.id}/ics`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 h-10 text-xs font-medium hover:bg-[var(--color-bg)] transition-colors border-t border-[var(--color-border)]"
            role="menuitem"
            download
          >
            <Download size={14} className="text-[var(--color-text-muted)]" />
            Descarcă .ics (Apple/alt)
          </a>
        </div>
      )}
    </div>
  );
}
