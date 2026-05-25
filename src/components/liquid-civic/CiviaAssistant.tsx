"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Send, Loader2, RefreshCw } from "lucide-react";
import { trackCustomEvent } from "@/components/analytics/CiviaTracker";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "civia:chat-history-v1";
const INITIAL_GREETING = "Salut! 👋 Sunt Civia Assistant. Te ajut sa intelegi drepturile tale civice si sa depui sesizari. Cu ce te pot ajuta?";

const QUICK_PROMPTS = [
  "Cum depun o sesizare?",
  "Cum contest o amenda?",
  "Ce drepturi am la informatii publice?",
  "Cat timp are primaria sa raspunda?",
];

/**
 * F1 Civia Assistant — floating chat bottom-right.
 *
 * Folosește Groq free tier (Llama 3.1 8B) cu system prompt civic.
 * Rate-limit 10 mesaje/15min/IP. Persistence localStorage (max 10 turns).
 *
 * Activat via buton flotant bottom-right pe TOATE paginile (mounted in layout).
 */
export function CiviaAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Batch 4 (5/22/2026) — suggested follow-ups după răspuns AI.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history on first open
  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
    setMessages([{ role: "assistant", content: INITIAL_GREETING }]);
  }, [open]);

  // Save history on change
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch { /* ignore */ }
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Autofocus input on open
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    // 2026-05-25 #12 — track AI chat message send. Include length +
    // conversation depth (câte mesaje user în această sesiune).
    const userMessageCount = messages.filter((m) => m.role === "user").length + 1;
    trackCustomEvent("chat-message-send", {
      length: content.length,
      depth: userMessageCount,
      isFirst: userMessageCount === 1 ? 1 : 0,
    });
    const startMs = Date.now();

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);
    setSuggestions([]); // Clear old suggestions

    try {
      // Batch 4 (5/22/2026) — context injection.
      // Detectează URL pentru a oferi context page la AI.
      const ctx: Record<string, string> = {};
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        ctx.page = path;
        // /[judet]/* → county code
        const countyMatch = path.match(/^\/([a-z]{1,3})(?:\/|$)/);
        if (countyMatch && countyMatch[1] && !["api", "admin", "cont", "auth"].includes(countyMatch[1])) {
          ctx.countyCode = countyMatch[1].toUpperCase();
        }
        // /sesizari/[code]
        const sesizareMatch = path.match(/^\/sesizari\/(\w+)/);
        if (sesizareMatch?.[1]) {
          ctx.sesizareCode = sesizareMatch[1];
        }
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: Object.keys(ctx).length > 0 ? ctx : undefined,
        }),
      });
      const json = await res.json();
      const latencyMs = Date.now() - startMs;
      if (!res.ok) {
        // #12 track AI error cu status + latency
        trackCustomEvent("chat-message-error", {
          status: res.status,
          latencyMs,
        });
        setError(json.error ?? "Eroare AI");
        return;
      }
      // #12 track success cu latency + reply length
      trackCustomEvent("chat-message-success", {
        latencyMs,
        replyLength: typeof json.reply === "string" ? json.reply.length : 0,
        hasSuggestions: Array.isArray(json.suggestions) && json.suggestions.length > 0 ? 1 : 0,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
      // Batch 4 — render suggested follow-ups dupa raspuns AI.
      if (Array.isArray(json.suggestions)) {
        setSuggestions(json.suggestions.slice(0, 3));
      }
    } catch {
      // #12 track network failure
      trackCustomEvent("chat-message-error", {
        status: 0,
        latencyMs: Date.now() - startMs,
        kind: "network",
      });
      setError("Eroare retea. Reincearca.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([{ role: "assistant", content: INITIAL_GREETING }]);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Floating button — bottom-right, desktop only (mobile uses fab) */}
      <button
        type="button"
        onClick={() => {
          // #12 — chat-open event pentru funnel (open → first message → conversation)
          trackCustomEvent("chat-open");
          setOpen(true);
        }}
        aria-label="Deschide Civia Assistant"
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white shadow-[var(--shadow-3)] hover:shadow-[var(--shadow-4)] active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 hidden md:inline-flex items-center justify-center lc-shine ${
          open ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
        }`}
      >
        <Sparkles size={22} aria-hidden="true" />
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Civia Assistant"
          aria-modal="false"
          className="fixed bottom-6 right-6 z-40 w-[calc(100vw-3rem)] sm:w-[400px] max-w-[400px] h-[calc(100vh-6rem)] sm:h-[600px] max-h-[600px] flex flex-col lc-glass-3 rounded-[var(--radius-lg)] shadow-[var(--shadow-4)] animate-modal-pop"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] flex items-center justify-center text-white shrink-0">
                <Sparkles size={14} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm text-[var(--color-text)] truncate">
                  Civia Assistant
                </h2>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  AI civic — Beta
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reseteaza conversatia"
                title="Reset"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <RefreshCw size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Inchide"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                  }`}
                >
                  {renderMessage(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[var(--color-surface-2)] rounded-2xl px-3 py-2 inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" aria-hidden="true" />
                  <span className="text-xs text-[var(--color-text-muted)]">Civia gandeste...</span>
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 px-2">
                {error}
              </p>
            )}
          </div>

          {/* Quick prompts (only when no user messages) */}
          {messages.filter((m) => m.role === "user").length === 0 && !loading && (
            <div className="px-4 py-2 border-t border-[var(--color-border)] flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSend(p)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-primary-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-primary-on-soft)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Batch 4 (5/22/2026) — Suggested follow-ups după răspuns AI.
              Visible doar cand sunt mesaje + nu se incarca + avem sugestii. */}
          {suggestions.length > 0 && !loading && messages.filter((m) => m.role === "user").length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--color-border)]">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1.5">
                Ai putea întreba și
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary-on-soft)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="px-3 py-3 border-t border-[var(--color-border)] flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Intreaba ceva..."
              rows={1}
              maxLength={2000}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] resize-none max-h-32"
              aria-label="Scrie mesajul tau"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Trimite"
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * Render markdown links + bold + bullets in chat message.
 * Simple version — no nested elements.
 */
function renderMessage(content: string): React.ReactNode {
  const lines = content.split("\n");
  return lines.map((line, i) => {
    if (line.trim().startsWith("- ")) {
      return (
        <div key={i} className="flex gap-1.5 my-0.5">
          <span aria-hidden="true">•</span>
          <span className="flex-1">{renderInline(line.trim().slice(2))}</span>
        </div>
      );
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <div key={i} className={i > 0 ? "mt-2" : ""}>
        {renderInline(line)}
      </div>
    );
  });
}

function renderInline(text: string): React.ReactNode {
  // Pattern: [label](/path) or **bold**
  const parts: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    if (match[1] && match[2]) {
      // Link
      const href = match[2];
      if (href.startsWith("/") || href.startsWith("https://civia.ro")) {
        parts.push(
          <Link
            key={key++}
            href={href}
            className="underline hover:no-underline text-current font-semibold"
          >
            {match[1]}
          </Link>,
        );
      } else {
        parts.push(
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline text-current font-semibold"
          >
            {match[1]}
          </a>,
        );
      }
    } else if (match[3]) {
      parts.push(
        <strong key={key++} className="font-bold">
          {match[3]}
        </strong>,
      );
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}
