"use client";

import { useState } from "react";
import { Printer, ExternalLink } from "lucide-react";

interface Props {
  baseUrl: string;
}

const TEMPLATES = [
  {
    id: "groapa",
    title: "Groapa în asfalt",
    headline: "GROAPĂ RAPORTATĂ",
    sub: "Scanează codul pentru a vedea statusul",
    color: "#dc2626",
    icon: "🕳️",
    path: "/sesizari",
  },
  {
    id: "gunoi",
    title: "Gunoi necolectat",
    headline: "GUNOI RAPORTAT",
    sub: "Vezi când vine salubritatea",
    color: "#f59e0b",
    icon: "🗑️",
    path: "/sesizari",
  },
  {
    id: "parcare",
    title: "Parcare ilegală",
    headline: "MAȘINĂ PE TROTUAR",
    sub: "Raportează și tu pe Civia",
    color: "#7c3aed",
    icon: "🚗",
    path: "/sesizari",
  },
  {
    id: "generic",
    title: "Generic — orice problemă",
    headline: "PROBLEMĂ?",
    sub: "Raportează la primărie prin Civia",
    color: "#059669",
    icon: "📮",
    path: "/sesizari",
  },
];

export function StickerGrid({ baseUrl }: Props) {
  const [selected, setSelected] = useState(TEMPLATES[0]!);

  const fullUrl = `${baseUrl}${selected.path}`;
  // QR via api.qrserver.com — gratuit, fără cont, ne-tracking.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(fullUrl)}&size=400x400&margin=8&qzone=2&color=0F172A&bgcolor=FFFFFF`;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className={`p-3 rounded-[var(--radius-xs)] border text-left transition-all ${
              selected.id === t.id
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            <div className="text-xl mb-1">{t.icon}</div>
            <div className="text-xs font-semibold">{t.title}</div>
          </button>
        ))}
      </div>

      {/* PRINTABLE PAGE — A4 8 stickere/grid */}
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-2)]">
          <p className="text-xs text-[var(--color-text-muted)]">Previzualizare — A4 print-ready</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            <Printer size={12} /> Printează
          </button>
        </div>
        <div
          className="print-area p-6 grid grid-cols-2 gap-4 bg-white"
          style={{ aspectRatio: "210/297" }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-2 border-dashed border-slate-300 rounded-lg p-3 flex items-center gap-3 text-slate-900"
              style={{ aspectRatio: "2/1" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="QR" width={80} height={80} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] font-extrabold uppercase tracking-wider leading-tight"
                  style={{ color: selected.color }}
                >
                  {selected.headline}
                </div>
                <div className="text-[9px] text-slate-600 mt-1 leading-tight">
                  {selected.sub}
                </div>
                <div className="text-[8px] text-slate-400 mt-1.5 inline-flex items-center gap-1">
                  <ExternalLink size={7} />
                  civia.ro
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Vrei sticker cu codul TĂU de sesizare? Intră pe sesizarea ta și apasă „Share" → „QR cod".
      </p>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            height: 297mm;
            padding: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
