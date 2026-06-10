"use client";

import { useMemo, useState } from "react";
import { ExternalLink, CalendarClock, BadgeCheck, Link2, Check, Users } from "lucide-react";
import {
  PROMISIUNE_STATUS_META,
  type Promisiune,
  type PromisiuneStatus,
} from "@/data/promisiuni";
import { sortPromisiuni, daysUntilTermen, termenProgress } from "@/lib/promisiuni/stats";

type StatusFilter = PromisiuneStatus | "toate";

const COUNTY_LABEL: Record<string, string> = {
  B: "București",
  CJ: "Cluj",
  IS: "Iași",
  TM: "Timiș",
  CT: "Constanța",
  BV: "Brașov",
  RO: "Național",
};

function CountdownLine({ p, nowIso }: { p: Promisiune; nowIso: string }) {
  const days = daysUntilTermen(p.termenIso, nowIso);
  if (days === null || p.status === "respectata" || p.status === "incalcata") return null;
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <CalendarClock size={13} aria-hidden="true" />
        Termen depășit cu {Math.abs(days)} {Math.abs(days) === 1 ? "zi" : "zile"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
      <CalendarClock size={13} aria-hidden="true" />
      {days === 0 ? "Termenul expiră azi" : `Mai sunt ${days} ${days === 1 ? "zi" : "zile"} până la termen`}
    </span>
  );
}

function ProgressBar({ p, nowIso }: { p: Promisiune; nowIso: string }) {
  const pct = termenProgress(p.dataSursa, p.termenIso, nowIso);
  if (pct === null || p.status === "respectata" || p.status === "incalcata") return null;
  const meta = PROMISIUNE_STATUS_META[p.status];
  return (
    <div
      className="h-1.5 w-full rounded-[var(--radius-full)] bg-[var(--color-surface-2)] overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% din perioada promisă a trecut`}
      title={`${pct}% din perioada promisă a trecut`}
    >
      <div
        className="h-full rounded-[var(--radius-full)] transition-all"
        style={{ width: `${pct}%`, background: meta.color }}
      />
    </div>
  );
}

function PromisiuneCard({ p, nowIso }: { p: Promisiune; nowIso: string }) {
  const meta = PROMISIUNE_STATUS_META[p.status];
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://civia.ro/promisometru#${p.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponibil */
    }
  };

  return (
    <article
      id={p.id}
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-1)] card-lift flex flex-col gap-3 scroll-mt-24"
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-text-muted)]">
            {p.autoritate} · {p.functie}
            {COUNTY_LABEL[p.county] && (
              <span className="ml-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">
                {COUNTY_LABEL[p.county]}
              </span>
            )}
          </p>
          <h3 className="mt-1 text-[15px] font-bold leading-snug text-[var(--color-text)]">
            {p.promisiune}
          </h3>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-bold text-white"
          style={{ background: meta.color }}
        >
          <span aria-hidden="true">{meta.icon}</span> {meta.label}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{p.nota}</p>

      <ProgressBar p={p} nowIso={nowIso} />

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          Termen: <strong className="text-[var(--color-text)]">{p.termen}</strong>
        </span>
        <CountdownLine p={p} nowIso={nowIso} />
        <a
          href={p.sursaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Sursă: {p.publicatie}
        </a>
        <span className="inline-flex items-center gap-1">
          <BadgeCheck size={13} aria-hidden="true" />
          Verificat la {p.verificatLa}
        </span>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
          {copied ? "Copiat" : "Copiază link"}
        </button>
      </div>
    </article>
  );
}

export function PromisometruList({ items }: { items: Promisiune[] }) {
  const [status, setStatus] = useState<StatusFilter>("toate");
  const [autoritate, setAutoritate] = useState<string | null>(null);
  // „Acum" calculat o dată per montare — suficient pentru countdown-uri de zile.
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      toate: items.length,
      respectata: 0,
      "in-curs": 0,
      intarziata: 0,
      incalcata: 0,
    };
    for (const p of items) c[p.status] += 1;
    return c;
  }, [items]);

  const autoritati = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items) m.set(p.autoritate, (m.get(p.autoritate) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    let out = items;
    if (status !== "toate") out = out.filter((p) => p.status === status);
    if (autoritate) out = out.filter((p) => p.autoritate === autoritate);
    return sortPromisiuni(out);
  }, [items, status, autoritate]);

  const statusPills: Array<{ key: StatusFilter; label: string; color?: string }> = [
    { key: "toate", label: "Toate" },
    ...(Object.keys(PROMISIUNE_STATUS_META) as PromisiuneStatus[]).map((s) => ({
      key: s as StatusFilter,
      label: PROMISIUNE_STATUS_META[s].label,
      color: PROMISIUNE_STATUS_META[s].color,
    })),
  ];

  return (
    <div>
      {/* Filtre status */}
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrează după status">
        {statusPills.map(({ key, label, color }) => {
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-1)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
              }`}
            >
              {color && !active && (
                <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
              )}
              {label}
              <span className={`tabular-nums ${active ? "text-white/80" : "text-[var(--color-text-muted)]"}`}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtre autoritate */}
      {autoritati.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filtrează după autoritate">
          <Users size={14} className="mt-1 text-[var(--color-text-muted)]" aria-hidden="true" />
          {autoritati.map(([name, n]) => {
            const active = autoritate === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setAutoritate(active ? null : name)}
                aria-pressed={active}
                className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                    : "border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                }`}
              >
                {name} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista — key pe filtre ca stagger-ul să re-ruleze la schimbarea lor */}
      {filtered.length > 0 ? (
        <div key={`${status}-${autoritate ?? "toti"}`} className="grid gap-4 sm:grid-cols-2 stagger-children">
          {filtered.map((p) => (
            <PromisiuneCard key={p.id} p={p} nowIso={nowIso} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Nicio promisiune nu se potrivește filtrelor alese.
        </div>
      )}
    </div>
  );
}
