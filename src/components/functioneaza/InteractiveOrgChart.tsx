"use client";

import { useState } from "react";
import { X, Phone, Mail, Wallet } from "lucide-react";
import { DIRECTII, type Directie } from "@/data/pmb-structura";
import { cn } from "@/lib/utils";

export function InteractiveOrgChart() {
  const [selected, setSelected] = useState<Directie | null>(null);

  return (
    <>
      <div className="relative">
        {/* Primar General */}
        <div className="flex justify-center mb-2">
          <div className="bg-gradient-to-br from-[var(--color-primary)] to-indigo-800 text-white rounded-[var(--radius-md)] px-6 py-3 text-center shadow-lg">
            <p className="text-xs opacity-80">Ales direct de cetățeni</p>
            <p className="font-bold">Primar General</p>
          </div>
        </div>
        <div className="w-0.5 h-6 bg-[var(--color-border)] mx-auto" />
        {/* Viceprimari */}
        <div className="grid grid-cols-2 gap-4 mb-2 max-w-md mx-auto">
          {["Viceprimar 1", "Viceprimar 2"].map((v) => (
            <div
              key={v}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] px-4 py-2 text-center text-sm font-medium"
            >
              {v}
            </div>
          ))}
        </div>
        <div className="w-0.5 h-6 bg-[var(--color-border)] mx-auto" />
        {/* Directii - clickable */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DIRECTII.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className={cn(
                "bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] px-3 py-2 text-center text-xs font-medium",
                "hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-on-soft)] transition-all",
                "cursor-pointer"
              )}
              title="Click pentru detalii"
            >
              {d.name.replace("Direcția ", "")}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">
          💡 Click pe o direcție pentru detalii
        </p>
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-[var(--color-primary)] to-indigo-700 text-white p-5 relative">
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
              >
                <X size={16} />
              </button>
              <h3 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-1">{selected.name}</h3>
              <p className="text-sm text-white/80">{selected.role}</p>
            </div>
            <div className="p-5">
              <h4 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
                Responsabilități
              </h4>
              <ul className="space-y-1.5 mb-4">
                {selected.responsabilitati.map((r, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-[var(--color-primary)] mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <Mail size={14} className="text-[var(--color-text-muted)] mt-0.5" />
                  <Phone size={14} className="text-[var(--color-text-muted)] mt-0.5" />
                  <span className="text-[var(--color-text-muted)]">{selected.contact}</span>
                </div>
                {selected.bugetAlocat && (
                  <div className="flex items-start gap-2 text-sm">
                    <Wallet size={14} className="text-[var(--color-text-muted)] mt-0.5" />
                    <span className="text-[var(--color-text-muted)]">
                      <strong className="text-[var(--color-text)]">Buget:</strong> {selected.bugetAlocat}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
