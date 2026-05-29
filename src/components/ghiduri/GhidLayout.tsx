"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, List, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ReadProgress } from "@/components/ReadProgress";

interface Chapter {
  id: string;
  title: string;
}

interface GhidLayoutProps {
  title: string;
  subtitle: string;
  icon: string;
  gradient: string;
  chapters: Chapter[];
  children: ReactNode;
  stats?: { label: string; value: string }[];
}

export function GhidLayout({
  title,
  subtitle,
  icon,
  gradient,
  chapters,
  children,
  stats,
}: GhidLayoutProps) {
  const [activeChapter, setActiveChapter] = useState(chapters[0]?.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // 2026-05-29 — passive + rAF throttle. Era non-passive (default false),
    // bloca scroll thread cu offsetTop reads per frame.
    let raf = 0;
    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const scrollY = window.scrollY + 200;
        for (let i = chapters.length - 1; i >= 0; i--) {
          const ch = chapters[i];
          if (!ch) continue;
          const el = document.getElementById(ch.id);
          if (el && el.offsetTop <= scrollY) {
            setActiveChapter(ch.id);
            break;
          }
        }
        raf = 0;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chapters]);

  return (
    <>
      <ReadProgress />
      {/* Hero */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${gradient} text-white`}>
        <div className="absolute inset-0 bg-grid-pattern opacity-15" />
        <div className="container-narrow relative z-10 py-16 md:py-24">
          <Link
            href="/ghiduri"
            className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-6 transition-colors"
          >
            <ChevronLeft size={16} /> Toate ghidurile
          </Link>
          <div className="flex items-start gap-6">
            <span className="text-6xl md:text-7xl hidden md:block">{icon}</span>
            <div>
              <h1 className="font-[family-name:var(--font-sora)] text-3xl md:text-5xl font-extrabold mb-3">
                {title}
              </h1>
              <p className="text-lg text-white/85 max-w-2xl mb-6">{subtitle}</p>
              {stats && (
                <div className="flex flex-wrap gap-6">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-xs text-white/60 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content with sidebar */}
      <div className="container-narrow py-12 grid lg:grid-cols-[260px_1fr] gap-12">
        {/* Sticky Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3">
              Cuprins
            </p>
            <nav className="space-y-1">
              {chapters.map((ch, i) => (
                <a
                  key={ch.id}
                  href={`#${ch.id}`}
                  className={cn(
                    "block px-3 py-2 rounded-[var(--radius-xs)] text-sm transition-all border-l-2",
                    activeChapter === ch.id
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] font-medium border-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] border-transparent hover:bg-[var(--color-surface-2)]"
                  )}
                >
                  <span className="text-[var(--color-text-muted)] text-xs mr-2">{i + 1}.</span>
                  {ch.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile TOC button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[var(--color-primary)] text-white shadow-lg flex items-center justify-center"
          aria-label="Cuprins"
        >
          <List size={22} />
        </button>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--color-surface)] p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold">Cuprins</h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
              <nav className="space-y-1">
                {chapters.map((ch, i) => (
                  <a
                    key={ch.id}
                    href={`#${ch.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3 py-2 rounded-[var(--radius-xs)] text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="text-[var(--color-text-muted)] text-xs mr-2">{i + 1}.</span>
                    {ch.title}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Content — min-w-0 critic ca grid-ul lg să nu intre în
            overflow pe sidebar/content split. break-words pe orice
            text descendant ca să acoperim mobile + cuvinte lungi
            (jurnaliști / nume proprii / link-uri inline). */}
        <article className="prose-civic max-w-none min-w-0 [&_p]:break-words [&_li]:break-words [&_h1]:break-words [&_h2]:break-words [&_h3]:break-words">{children}</article>
      </div>
    </>
  );
}

export function Chapter({
  id,
  title,
  children,
  number,
}: {
  id: string;
  title: string;
  children: ReactNode;
  number: number;
}) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <div className="flex items-baseline gap-3 mb-4">
        <Badge variant="primary" className="shrink-0">
          Capitolul {number}
        </Badge>
      </div>
      <h2 className="font-[family-name:var(--font-sora)] text-3xl md:text-4xl font-bold mb-6 !mt-0">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "tip" | "warning" | "success";
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200",
    tip: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200",
    warning: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200",
    success: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-900 dark:text-green-200",
  };
  const icons = { info: "ℹ️", tip: "💡", warning: "⚠️", success: "✅" };
  return (
    <div className={cn("my-5 p-4 border-l-4 rounded-r-[12px]", styles[type])}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{icons[type]}</span>
        <div className="flex-1">
          {title && <p className="font-semibold mb-1">{title}</p>}
          <div className="text-sm [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
