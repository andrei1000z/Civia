"use client";

import { useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Highlighter,
  Heading1, Heading2, Heading3, List, Link2, Code,
  Palette, Type, Eye, Pencil,
} from "lucide-react";
import { renderMarkdown } from "@/lib/actualizari/render-markdown";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  /** Show live preview pe partea dreaptă (sau dedesubt pe mobile) */
  showPreview?: boolean;
}

const COLORS = [
  { value: "red", label: "Roșu", hex: "#DC2626" },
  { value: "orange", label: "Portocaliu", hex: "#F97316" },
  { value: "yellow", label: "Galben", hex: "#F59E0B" },
  { value: "green", label: "Verde", hex: "#059669" },
  { value: "blue", label: "Albastru", hex: "#0891B2" },
  { value: "purple", label: "Violet", hex: "#7C3AED" },
  { value: "pink", label: "Roz", hex: "#EC4899" },
  { value: "gray", label: "Gri", hex: "#6B7280" },
];

const SIZES = [
  { value: "small", label: "Mic" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Mare" },
  { value: "huge", label: "Uriaș" },
];

/**
 * Markdown editor cu toolbar care wrap-uiește selecția în sintaxa
 * markdown-extended Civia: **bold**, *italic*, ~~strike~~, __underline__,
 * ==highlight==, {color:red}text{/color}, {size:large}text{/size}, # H1,
 * - listă, [text](url), `cod`.
 *
 * Plan 5/23/2026 — folosit în /admin/actualizari pentru editare versiuni.
 * Live preview cu acelasi renderer ca pagina publică /actualizari.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Scrie aici...",
  rows = 12,
  showPreview = true,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  /**
   * Wrap selecția curentă cu prefix + suffix.
   * Dacă nu e nimic selectat, inserează „placeholder" între delimiteri.
   */
  function wrap(prefix: string, suffix: string, placeholderText = "text") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const insert = selected || placeholderText;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = `${before}${prefix}${insert}${suffix}${after}`;
    onChange(next);
    // Re-focus + position cursor între delimitere
    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = start + prefix.length;
      ta.setSelectionRange(cursorStart, cursorStart + insert.length);
    });
  }

  /**
   * Inserează la începutul liniei curente (pentru # heading, - list).
   */
  function prependLine(token: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    const next = `${value.slice(0, lineStart)}${token}${value.slice(lineStart)}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + token.length;
      ta.setSelectionRange(newPos, newPos);
    });
  }

  function applyLink() {
    const url = prompt("URL link (https://... sau /path):", "https://");
    if (!url) return;
    wrap("[", `](${url})`, "text link");
  }

  const btn =
    "h-8 px-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 transition-colors flex items-center gap-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

  return (
    <div className="space-y-2">
      {/* TAB switcher Edit / Preview (mobile-friendly) */}
      {showPreview && (
        <div className="flex gap-1 lg:hidden">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`h-8 px-3 rounded-[var(--radius-xs)] text-xs font-semibold ${
              tab === "edit"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            }`}
          >
            <Pencil size={12} className="inline mr-1" aria-hidden="true" />
            Editor
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`h-8 px-3 rounded-[var(--radius-xs)] text-xs font-semibold ${
              tab === "preview"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            }`}
          >
            <Eye size={12} className="inline mr-1" aria-hidden="true" />
            Preview
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] border border-[var(--color-border)]">
        <button type="button" onClick={() => wrap("**", "**")} className={btn} title="Bold (**text**)">
          <Bold size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => wrap("*", "*")} className={btn} title="Italic (*text*)">
          <Italic size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => wrap("__", "__")} className={btn} title="Underline (__text__)">
          <Underline size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => wrap("~~", "~~")} className={btn} title="Strikethrough (~~text~~)">
          <Strikethrough size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => wrap("==", "==")} className={btn} title="Highlight (==text==)">
          <Highlighter size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => wrap("`", "`")} className={btn} title="Inline code (`text`)">
          <Code size={14} aria-hidden="true" />
        </button>
        <div className="w-px bg-[var(--color-border)] mx-1" aria-hidden="true" />
        <button type="button" onClick={() => prependLine("# ")} className={btn} title="Heading 1">
          <Heading1 size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => prependLine("## ")} className={btn} title="Heading 2">
          <Heading2 size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => prependLine("### ")} className={btn} title="Heading 3">
          <Heading3 size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => prependLine("- ")} className={btn} title="Listă (- item)">
          <List size={14} aria-hidden="true" />
        </button>
        <button type="button" onClick={applyLink} className={btn} title="Link [text](url)">
          <Link2 size={14} aria-hidden="true" />
        </button>
        <div className="w-px bg-[var(--color-border)] mx-1" aria-hidden="true" />
        {/* Color picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setColorOpen((s) => !s); setSizeOpen(false); }}
            className={btn}
            title="Culoare text"
          >
            <Palette size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Culoare</span>
          </button>
          {colorOpen && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-3)] p-2 flex gap-1 flex-wrap min-w-[200px]">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    wrap(`{color:${c.value}}`, "{/color}");
                    setColorOpen(false);
                  }}
                  className="w-7 h-7 rounded-full border border-[var(--color-border)] hover:scale-110 transition-transform"
                  style={{ background: c.hex }}
                  aria-label={`Culoare ${c.label}`}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>
        {/* Size picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setSizeOpen((s) => !s); setColorOpen(false); }}
            className={btn}
            title="Mărime text"
          >
            <Type size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Mărime</span>
          </button>
          {sizeOpen && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-3)] p-1 flex flex-col min-w-[140px]">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    wrap(`{size:${s.value}}`, "{/size}");
                    setSizeOpen(false);
                  }}
                  className="h-8 px-3 text-xs text-left rounded-[var(--radius-xs)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor + Preview split */}
      <div className={showPreview ? "grid lg:grid-cols-2 gap-3" : ""}>
        <div className={tab === "preview" ? "hidden lg:block" : ""}>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] resize-y min-h-[200px]"
            spellCheck
          />
        </div>
        {showPreview && (
          <div className={tab === "edit" ? "hidden lg:block" : ""}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1">
              <Eye size={11} aria-hidden="true" />
              Preview
            </div>
            <div className="px-4 py-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] min-h-[200px] overflow-y-auto max-h-[400px] text-[var(--color-text)]">
              {value ? (
                renderMarkdown(value)
              ) : (
                <p className="text-xs text-[var(--color-text-muted)] italic">
                  Preview-ul apare aici când scrii ceva...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
