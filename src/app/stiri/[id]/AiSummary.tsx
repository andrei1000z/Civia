"use client";

import { useMemo, useState, useEffect } from "react";
import { Loader2, Copy, Check, Volume2, VolumeX, Clock } from "lucide-react";

/**
 * Renders inline markdown for **bold** spans inside a paragraph, plus a
 * subtle highlight chip around inline numbers (with units). We avoid a
 * full markdown lib because the AI output is constrained to bold + bullets,
 * and dangerouslySetInnerHTML on user-adjacent text is risky.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // First pass: split on **bold** spans
  const tokens: { kind: "text" | "bold"; value: string }[] = [];
  const pattern = /\*\*([^*]+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, m.index) });
    }
    tokens.push({ kind: "bold", value: m[1] ?? "" });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) tokens.push({ kind: "text", value: text.slice(lastIndex) });

  // Second pass: in plain-text spans only, wrap "150 km" / "26 țări" /
  // "92 experți" / "800 experiențe" / "75%" / "10.000 lei" with a small
  // <mark> chip so the eye finds the data quickly when scanning.
  const NUMBER_RE =
    /\b(\d+(?:[.,]\d+)?)\s*(%|km|kilometri|ani|luni|săptămâni|zile|ore|minute|secunde|lei|euro|€|milioane|miliarde|persoane|cetățeni|români|locuitori|vizitatori|participanți|spectatori|țări|state|experți|specialiști|invitați|profesori|jurnaliști|experiențe|workshop-uri|sesiuni|evenimente|activități|ateliere|conferințe|stații|secții|locuri|centre|spitale|școli|sedii)\b/gi;

  const out: React.ReactNode[] = [];
  let bIdx = 0;
  tokens.forEach((tok, ti) => {
    if (tok.kind === "bold") {
      out.push(
        <strong key={`${keyPrefix}-b${bIdx++}`} className="font-bold text-[var(--color-text)]">
          {tok.value}
        </strong>,
      );
      return;
    }
    let li = 0;
    let lm: RegExpExecArray | null;
    NUMBER_RE.lastIndex = 0;
    let i = 0;
    while ((lm = NUMBER_RE.exec(tok.value)) !== null) {
      if (lm.index > li) {
        out.push(`${tok.value.slice(li, lm.index)}`);
      }
      out.push(
        <span
          key={`${keyPrefix}-n${ti}-${i++}`}
          className="font-semibold text-violet-700 dark:text-violet-400 px-0.5 underline decoration-violet-300/60 dark:decoration-violet-500/40 decoration-1 underline-offset-2"
        >
          {lm[0]}
        </span>,
      );
      li = lm.index + lm[0].length;
    }
    if (li < tok.value.length) out.push(tok.value.slice(li));
  });
  return out;
}

function estimateReadMinutes(plainText: string): number {
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  // Romanian readers ~210 wpm for non-technical prose.
  return Math.max(1, Math.round(words / 210));
}

interface AiSummaryProps {
  /** Pre-rendered server-side summary. When non-null, no client fetch
   *  is issued. */
  initialSummary: string | null;
  /** Plain fallback text (the article excerpt / petition summary) used
   *  if the AI generation fails. */
  fallbackText: string;
  /** Optional URL the client hits when initialSummary is null. Returns
   *  `{ data: { summary } }`. If absent, the component just renders the
   *  fallback after the load step. */
  synthesizeUrl?: string;
}

export function AiSummary({ initialSummary, fallbackText, synthesizeUrl }: AiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [loading, setLoading] = useState(!initialSummary && !!synthesizeUrl);

  useEffect(() => {
    if (initialSummary) return;
    if (!synthesizeUrl) {
      // setState in effect is intentional: we only fall back to the plain
      // excerpt after mount (so SSR/CSR markup matches the loading state).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummary(fallbackText);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(synthesizeUrl)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.data?.summary) {
          setSummary(j.data.summary);
        }
      })
      .catch(() => {
        if (!cancelled) setSummary(fallbackText);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [synthesizeUrl, initialSummary, fallbackText]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-4" role="status" aria-live="polite">
        <Loader2 size={16} className="motion-safe:animate-spin text-violet-500" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-muted)]">
          Se generează sinteza…
        </p>
      </div>
    );
  }

  if (!summary) {
    // Bug fix UX (5/22/2026) — fallback elegant cand AI fail:
    // afișează excerpt-ul original cu label clar „Sinteză indisponibilă"
    // in loc de italic muted text generic. Userul intelege ca AI a esuat,
    // dar tot are conținut util.
    return (
      <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
          <span aria-hidden="true">⚠️</span>
          Sinteză AI indisponibilă
        </div>
        {fallbackText ? (
          <p className="text-sm text-[var(--color-text)] leading-relaxed">
            {fallbackText}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            AI-ul nu a putut sumariza acest articol momentan. Citește textul
            original pentru detalii complete.
          </p>
        )}
      </div>
    );
  }

  // ── Group consecutive `- ` bullet lines into <ul>, render the rest as
  //    paragraphs / headings. Inline **bold** is rendered everywhere.
  const lines = summary.split("\n");
  const blocks: React.ReactNode[] = [];
  let bulletBuf: string[] = [];

  const flushBullets = () => {
    if (bulletBuf.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="space-y-1.5 my-3 pl-1"
      >
        {bulletBuf.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-[var(--color-text)] leading-relaxed"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-[0.55rem] shrink-0"
              aria-hidden="true"
            />
            <span>{renderInline(b, `li-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
    bulletBuf = [];
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      return;
    }

    // Bullet line: `- xxx` or `* xxx`
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch && bulletMatch[1]) {
      bulletBuf.push(bulletMatch[1]);
      return;
    }

    flushBullets();

    // Whole-line heading wrapped in **
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      blocks.push(
        <h3
          key={i}
          className="font-[family-name:var(--font-sora)] font-bold text-base mt-5 mb-2 text-[var(--color-text)]"
        >
          {line.replace(/^\*\*|\*\*$/g, "")}
        </h3>,
      );
      return;
    }

    // Section headers like „De ce contează:" — accept three shapes:
    //   1. „Pe scurt:" alone on a line  → render as h3, content on next line
    //   2. „**Pe scurt:** Content..."   → split into h3 + p (markdown style)
    //   3. „Pe scurt: Content..."       → split into h3 + p (plain style)
    // Without #2/#3 splitting, the AI's preferred „heading: content"
    // shape on a single line gets matched as a heading and the WHOLE
    // sentence renders violet — exactly the "everything is purple" bug.
    const HEADING_RE =
      /^\*?\*?(Pe scurt|De ce contează|Context|Cifre cheie|Cifre & date cheie|Ce urmează|Programul|Detalii|Ce cere petiția)\*?\*?\s*:?\s*(.*)$/i;
    const m = line.match(HEADING_RE);
    if (m) {
      const label = m[1] ?? "";
      const rest = (m[2] ?? "").trim();
      blocks.push(
        <h3
          key={`h-${i}`}
          className="font-[family-name:var(--font-sora)] font-bold text-sm mt-5 mb-1.5 text-violet-700 dark:text-violet-400"
        >
          {label}:
        </h3>,
      );
      if (rest.length > 0) {
        blocks.push(
          <p
            key={`hp-${i}`}
            className="mb-2.5 text-sm text-[var(--color-text)] leading-relaxed"
          >
            {renderInline(rest, `hp-${i}`)}
          </p>,
        );
      }
      return;
    }

    blocks.push(
      <p
        key={i}
        className="mb-2.5 text-sm text-[var(--color-text)] leading-relaxed"
      >
        {renderInline(line, `p-${i}`)}
      </p>,
    );
  });

  flushBullets();

  return (
    <div className="prose-civic">
      <SummaryToolbar text={summary} />
      {blocks}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

/**
 * Sticky toolbar above the rendered summary: reading time, copy-to-clipboard
 * and a Listen button (browser-native SpeechSynthesis, ro-RO if available).
 * All actions degrade gracefully when the API isn't there (Safari iOS lockdown,
 * old browsers).
 */
function SummaryToolbar({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  const minutes = useMemo(() => estimateReadMinutes(text.replace(/\*\*/g, "")), [text]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // setState in effect is intentional: we have to read window.speechSynthesis
    // post-mount to avoid SSR/CSR hydration mismatch. ESLint warning is acked.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceAvailable(typeof window.speechSynthesis !== "undefined");
    return () => {
      // Stop reading if the user navigates away mid-utterance.
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/\*\*/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — silent fail; the user can select-and-copy manually.
    }
  };

  const toggleSpeak = () => {
    if (!voiceAvailable) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utt = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""));
    utt.lang = "ro-RO";
    utt.rate = 1.05;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    synth.speak(utt);
    setSpeaking(true);
  };

  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--color-border)]">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium">
        <Clock size={11} aria-hidden="true" />
        {minutes} {minutes === 1 ? "minut" : "minute"} de citit
      </span>
      <div className="ml-auto flex items-center gap-1">
        {voiceAvailable && (
          <button
            type="button"
            onClick={toggleSpeak}
            aria-pressed={speaking}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--radius-xs)] text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            title={speaking ? "Oprește citirea" : "Ascultă sinteza"}
          >
            {speaking ? <VolumeX size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />}
            {speaking ? "Stop" : "Ascultă"}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--radius-xs)] text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          title="Copiază sinteza"
        >
          {copied ? <Check size={12} className="text-emerald-500" aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>
    </div>
  );
}
