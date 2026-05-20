"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { SESIZARI_TEMPLATES, type SesizareTemplate } from "@/data/sesizari-templates";

interface Props {
  /** Callback când userul selectează un template — completează form. */
  onSelect: (template: SesizareTemplate) => void;
  className?: string;
}

/**
 * F7 Template Picker — quick-start templates pentru sesizări comune.
 *
 * Afișat pe /sesizari deasupra form. Click pe card → form pre-completed
 * cu tip + descriere generic. User editează doar specificul.
 *
 * Reduce timpul de la 90s → 30s pentru cazurile frecvente (60%+ din
 * sesizări sunt parcare/trotuar/iluminat).
 */
export function SesizareTemplatePicker({ onSelect, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Top 4 cele mai populare — afisate intotdeauna
  const popular = SESIZARI_TEMPLATES.slice(0, 4);
  const rest = SESIZARI_TEMPLATES.slice(4);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Rapid: alege un template
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          (sau scrie de la zero mai jos)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {popular.map((t) => (
          <TemplateCard key={t.id} template={t} onSelect={onSelect} />
        ))}
        {expanded &&
          rest.map((t) => (
            <TemplateCard key={t.id} template={t} onSelect={onSelect} />
          ))}
      </div>

      {!expanded && rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded px-1"
        >
          Vezi încă {rest.length} templates
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      )}
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded px-1"
        >
          Mai puține
          <ChevronUp size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: SesizareTemplate;
  onSelect: (t: SesizareTemplate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className="group flex flex-col items-start gap-1 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)]/30 transition-all text-left min-h-[5rem] active:scale-[0.97]"
      aria-label={`Folosește template: ${template.label}`}
    >
      <span className="text-2xl" aria-hidden="true">
        {template.emoji}
      </span>
      <span className="text-xs font-semibold text-[var(--color-text)] leading-tight">
        {template.label}
      </span>
    </button>
  );
}
