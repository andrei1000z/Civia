"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Star, AlertTriangle, CheckCircle2, Users, X, ChevronDown, Filter, GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDecimal } from "@/lib/utils";
import type { Primar } from "@/types";

interface Props {
  primari: Primar[];
}

function Rating({ value }: { value: number }) {
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`Notă ${formatDecimal(value, 1)} din 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          aria-hidden="true"
          className={
            i <= full
              ? "fill-amber-400 text-amber-400"
              : i === full + 1 && hasHalf
              ? "fill-amber-400/50 text-amber-400"
              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
          }
        />
      ))}
      <span className="text-xs text-[var(--color-text-muted)] ml-1 tabular-nums" aria-hidden="true">{formatDecimal(value, 1)}</span>
    </div>
  );
}

function decada(an: number): string {
  if (an < 2000) return "1990-1999";
  if (an < 2010) return "2000-2009";
  if (an < 2020) return "2010-2019";
  return "2020-prezent";
}

const DECADE = ["toate", "1990-1999", "2000-2009", "2010-2019", "2020-prezent"];

export function IstoricInteractive({ primari }: Props) {
  const [filterPartid, setFilterPartid] = useState<string>("toate");
  const [filterDecada, setFilterDecada] = useState<string>("toate");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [modalId, setModalId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<Record<string, string | null>>({});

  // Cache anul curent — evita `new Date().getFullYear()` repetat în render
  // care ar putea rări să producă valori diferite SSR vs client la cross-year
  // midnight boundary (hydration mismatch). useState initializer rulează pe
  // ambele, dar diferența e <1ms la New Year — practic irelevantă.
  const [currentYear] = useState(() => new Date().getFullYear());

  const partide = useMemo(() => Array.from(new Set(primari.map((p) => p.partid))), [primari]);

  const filtered = useMemo(() => {
    return primari.filter((p) => {
      if (filterPartid !== "toate" && p.partid !== filterPartid) return false;
      if (filterDecada !== "toate" && decada(p.anInceput) !== filterDecada) return false;
      return true;
    });
  }, [primari, filterPartid, filterDecada]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2 && prev[1]) return [prev[1], id];
      return [...prev, id];
    });
  };

  const modalPrimar = modalId ? primari.find((p) => p.id === modalId) : null;
  const compared = compareIds.map((id) => primari.find((p) => p.id === id)).filter(Boolean) as Primar[];

  // Aggregate stats
  const avgDurata = useMemo(() => {
    const durate = primari.map((p) => (p.anSfarsit ?? currentYear) - p.anInceput);
    return (durate.reduce((a, b) => a + b, 0) / durate.length).toFixed(1);
  }, [primari, currentYear]);

  return (
    <div>
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatMini label="Primari totali" value={primari.length.toString()} />
        <StatMini label="Media mandat" value={`${avgDurata} ani`} />
        <StatMini label="Arestați în funcție" value="2" detail="Oprescu 2015, ..." />
        <StatMini label="Durată max" value="7 ani" detail="Sorin Oprescu" />
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-[var(--color-text-muted)]" />
          <span className="text-sm font-medium">Filtrează</span>
          {compareIds.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] text-xs font-medium">
              <GitCompare size={12} />
              {compareIds.length}/2 selectați pentru comparare
              <button onClick={() => setCompareIds([])} className="ml-1 opacity-60 hover:opacity-100">
                <X size={12} />
              </button>
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Partid</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filterPartid === "toate"} onClick={() => setFilterPartid("toate")}>
                Toate
              </FilterChip>
              {partide.map((p) => (
                <FilterChip key={p} active={filterPartid === p} onClick={() => setFilterPartid(p)}>
                  {p}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Decada</p>
            <div className="flex flex-wrap gap-1.5">
              {DECADE.map((d) => (
                <FilterChip key={d} active={filterDecada === d} onClick={() => setFilterDecada(d)}>
                  {d === "toate" ? "Toate" : d}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compare panel */}
      {compared.length === 2 && (
        <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)] rounded-[var(--radius-md)] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <GitCompare size={18} className="text-[var(--color-primary)]" />
              Comparare primari
            </h3>
            <button
              onClick={() => setCompareIds([])}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {compared.map((p) => (
              <div key={p.id} className="bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-[var(--radius-xs)] text-white font-bold flex items-center justify-center"
                    style={{ background: p.culoarePartid }}
                  >
                    {p.initiale}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{p.nume}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{p.perioada}</p>
                  </div>
                </div>
                <div className="text-xs space-y-1.5">
                  <p><strong>Partid:</strong> {p.partid}</p>
                  <p><strong>Durata:</strong> {(p.anSfarsit ?? currentYear) - p.anInceput} ani</p>
                  <p><strong>Rating:</strong> {p.rating}/5</p>
                  <p><strong>Realizări:</strong> {p.realizari.length}</p>
                  <p><strong>Controverse:</strong> {p.controverse.length}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of primari */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((primar) => (
          <div
            key={primar.id}
            role="button"
            tabIndex={0}
            className={cn(
              "group relative bg-[var(--color-surface)] border rounded-[var(--radius-md)] p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              compareIds.includes(primar.id)
                ? "border-[var(--color-primary)] border-2"
                : "border-[var(--color-border)]"
            )}
            onClick={() => setModalId(primar.id)}
            onKeyDown={(e) => {
              // audit fix: card accesibil de la tastatură (înainte doar onClick pe div).
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setModalId(primar.id);
              }
            }}
          >
            {/* Compare checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCompare(primar.id);
              }}
              className={cn(
                "absolute top-3 right-3 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors z-10",
                compareIds.includes(primar.id)
                  ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] opacity-0 group-hover:opacity-100"
              )}
              title="Adaugă la comparare"
            >
              {compareIds.includes(primar.id) && (
                <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <div className="flex items-start gap-3 mb-3">
              {primar.photo ? (
                <div className="w-12 h-12 rounded-[var(--radius-xs)] overflow-hidden shrink-0 ring-2" style={{ '--tw-ring-color': primar.culoarePartid } as React.CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/primari/${primar.photo}.webp`}
                    alt={primar.nume}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div
                  className="w-12 h-12 rounded-[var(--radius-xs)] text-white font-bold flex items-center justify-center shrink-0"
                  style={{ background: primar.culoarePartid }}
                >
                  {primar.initiale}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-0.5 truncate">{primar.nume}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{primar.perioada}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge bgColor={primar.culoarePartid} color="white" className="text-[10px]">
                {primar.partid}
              </Badge>
              <Rating value={primar.rating} />
            </div>
            <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                {primar.realizari.length}
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle size={12} />
                {primar.controverse.length}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <p className="text-[var(--color-text-muted)] text-sm mb-3">
            Niciun primar nu corespunde combinației de filtre selectate.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterPartid("toate");
              setFilterDecada("toate");
            }}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Resetează filtrele
          </button>
        </div>
      )}

      {/* Modal */}
      {modalPrimar && (
        <PrimarModal
          primar={modalPrimar}
          onClose={() => setModalId(null)}
          expandedSection={expandedSection[modalPrimar.id] ?? null}
          onExpand={(section) =>
            setExpandedSection((prev) => ({
              ...prev,
              [modalPrimar.id]: prev[modalPrimar.id] === section ? null : section,
            }))
          }
          currentYear={currentYear}
        />
      )}
    </div>
  );
}

function PrimarModal({
  primar,
  onClose,
  expandedSection,
  onExpand,
  currentYear,
}: {
  primar: Primar;
  onClose: () => void;
  expandedSection: string | null;
  onExpand: (section: string) => void;
  currentYear: number;
}) {
  const sections = [
    { id: "realizari", label: "Realizări", icon: CheckCircle2, items: primar.realizari, color: "text-emerald-600" },
    { id: "controverse", label: "Controverse", icon: AlertTriangle, items: primar.controverse, color: "text-red-600" },
    { id: "proiecte", label: "Proiecte majore", icon: Users, items: primar.proiecte, color: "text-blue-600" },
    { id: "viceprimari", label: "Viceprimari", icon: Users, items: primar.viceprimari, color: "text-purple-600" },
  ];

  // audit a11y: semantică dialog + Escape + focus trap + restaurare focus.
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null)
        : [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!, last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); triggerRef.current?.focus(); };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalii primar ${primar.nume}`}
        className="w-full max-w-2xl bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-6 rounded-t-[12px] text-white relative"
          style={{ background: `linear-gradient(135deg, ${primar.culoarePartid}, ${primar.culoarePartid}dd)` }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide modalul cu detalii primar"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={16} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-4">
            {primar.photo ? (
              <div className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden ring-2 ring-white/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/primari/${primar.photo}.webp`}
                  alt={primar.nume}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-[var(--radius-md)] bg-white/20 flex items-center justify-center text-3xl font-bold backdrop-blur">
                {primar.initiale}
              </div>
            )}
            <div>
              <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold mb-1">{primar.nume}</h2>
              <p className="text-sm text-white/80">{primar.perioada}</p>
              <div className="mt-2">
                <Badge className="bg-white/20 text-white border border-white/30">{primar.partid}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Rating cetățeni</p>
              <Rating value={primar.rating} />
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)]">Durata mandat</p>
              <p className="font-bold text-lg">
                {(primar.anSfarsit ?? currentYear) - primar.anInceput} ani
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {sections.map((s) => {
              const isOpen = expandedSection === s.id;
              const Icon = s.icon;
              return (
                <div key={s.id} className="border border-[var(--color-border)] rounded-[var(--radius-xs)] overflow-hidden">
                  <button
                    onClick={() => onExpand(s.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={s.color} />
                      <span className="font-medium text-sm">{s.label}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">({s.items.length})</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn("transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && (
                    <ul className="p-3 pt-0 space-y-1.5">
                      {s.items.map((item, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-[var(--color-text-muted)] mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-[var(--radius-pill)] text-xs font-medium transition-colors",
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
      )}
    >
      {children}
    </button>
  );
}

function StatMini({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3">
      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1">
        {label}
      </p>
      <p className="text-xl font-bold">{value}</p>
      {detail && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{detail}</p>}
    </div>
  );
}
