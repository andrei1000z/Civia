"use client";

import { Marker, Popup } from "react-leaflet";
import Link from "next/link";
import { createColoredIcon } from "./LeafletMap";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface MarkerData {
  id: string;
  code: string;
  titlu: string;
  locatie: string;
  status: string;
  data: string;
  comentarii: number;
  coords: [number, number];
}

export default function SesizariMarkersLayer({ data }: { data: MarkerData[] }) {
  return (
    <>
      {data.map((s) => (
        <Marker
          key={s.id}
          position={s.coords}
          icon={createColoredIcon(STATUS_COLORS[s.status] ?? "#64748B")}
        >
          <Popup>
            <div className="min-w-[220px]">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ background: STATUS_COLORS[s.status] ?? "#64748B" }}
                >
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{formatDate(s.data)}</span>
              </div>
              <p className="font-semibold text-sm mb-1">{s.titlu}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{s.locatie}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {s.comentarii} {s.comentarii === 1 ? "comentariu" : "comentarii"}
              </p>
              <Link
                href={`/sesizari/${s.code}`}
                className="inline-block mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                Vezi detalii →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
