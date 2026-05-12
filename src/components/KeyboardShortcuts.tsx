"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["Ctrl", "K"], label: "Deschide căutarea globală" },
  { keys: ["/"], label: "Focus pe căutare (alternativă)" },
  { keys: ["?"], label: "Arată acest panou de scurtături" },
  { keys: ["g", "h"], label: "Acasă" },
  { keys: ["g", "s"], label: "Trimite o sesizare" },
  { keys: ["g", "p"], label: "Sesizări publice" },
  { keys: ["g", "e"], label: "Petiții" },
  { keys: ["g", "r"], label: "Proteste programate" },
  { keys: ["g", "u"], label: "Urmărește sesizarea ta" },
  { keys: ["g", "a"], label: "Calitatea aerului" },
  { keys: ["g", "i"], label: "Știri locale" },
  { keys: ["g", "d"], label: "Ghiduri" },
  { keys: ["Esc"], label: "Închide modal / panou" },
];

/**
 * Global keyboard shortcut overlay. Opens when user presses "?" (unless
 * focus is inside a form field). Also implements a small "g X" chord
 * router — g then h goes home, g then s goes to sesizări, etc.
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let chord: string | null = null;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    const isEditableTarget = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      // ? → open help (ignore while typing)
      if (e.key === "?" && !isEditableTarget(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // Esc → close
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      // `/` → focus search (dispatches the existing palette event)
      if (e.key === "/" && !isEditableTarget(e.target)) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-command-palette"));
        return;
      }

      // "g X" chord navigation
      if (isEditableTarget(e.target)) return;
      if (chord === "g") {
        // Chord destinations. \"a\" now goes to /aer (public)
        // instead of /admin (admin-only — was a usability trap for
        // non-admins who hit g,a). \"d\" is ghiduri (\"documente\"),
        // \"u\" urmărește, \"p\" publice.
        const dest: Record<string, string> = {
          h: "/",
          s: "/sesizari",
          p: "/sesizari-publice",
          e: "/petitii",
          r: "/proteste",
          u: "/urmareste",
          a: "/aer",
          i: "/stiri",
          d: "/ghiduri",
          c: "/calendar-civic",
        };
        const url = dest[e.key];
        if (url) {
          e.preventDefault();
          // Soft nav — stays inside the SPA, keeps scroll/state
          // behaviour consistent with clicking a <Link>.
          router.push(url);
        }
        chord = null;
        if (chordTimer) clearTimeout(chordTimer);
        return;
      }
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        chord = "g";
        chordTimer = setTimeout(() => {
          chord = null;
        }, 1500);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (chordTimer) clearTimeout(chordTimer);
    };
  }, [open, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] overflow-hidden animate-modal-pop"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--color-primary)]" aria-hidden="true" />
            <h3 id="kbd-shortcuts-title" className="font-semibold">Scurtături tastatură</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Închide panoul de scurtături"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <ul className="py-2">
          {SHORTCUTS.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              <span>{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-5 py-3 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
          Apasă <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-2)] rounded font-mono text-[10px]">?</kbd> oricând pt. a deschide acest panou.
        </p>
      </div>
    </div>
  );
}
