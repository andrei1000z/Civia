import { ImageResponse } from "next/og";
import { getSesizareByCode } from "@/lib/sesizari/repository";

export const runtime = "nodejs";
export const alt = "Sesizare Civia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STATUS_COLORS: Record<string, string> = {
  "nou": "#3b82f6",
  "in-lucru": "#f59e0b",
  "rezolvat": "#10b981",
  "respins": "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  "nou": "Nou",
  "in-lucru": "În lucru",
  "rezolvat": "Rezolvat",
  "respins": "Respins",
};

const TIP_ICONS: Record<string, string> = {
  groapa: "🕳️",
  trotuar: "🚶",
  iluminat: "💡",
  copac: "🌳",
  gunoi: "🗑️",
  parcare: "🅿️",
  stalpisori: "🧱",
  canalizare: "🚰",
  semafor: "🚦",
  pietonal: "🛑",
  graffiti: "🎨",
  mobilier: "🪑",
  zgomot: "🔊",
  animale: "🐾",
  transport: "🚌",
  afisaj: "📢",
  altele: "📝",
};

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trim() + "…";
}

export default async function SesizareOG({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const sesizare = await getSesizareByCode(code).catch(() => null);

  const title = truncate(sesizare?.titlu ?? "Sesizare negăsită", 90);
  const status = sesizare?.status ?? "nou";
  const tip = sesizare?.tip ?? "altele";
  const sector = sesizare?.sector ?? "";
  const locatie = truncate(sesizare?.locatie ?? "", 80);
  const statusColor = STATUS_COLORS[status] ?? "#64748b";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const tipIcon = TIP_ICONS[tip] ?? "📝";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1C4ED8 100%)",
          padding: "72px 80px",
          position: "relative",
          fontFamily: "system-ui",
        }}
      >
        {/* Header: logo + Civia + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "linear-gradient(135deg, #ffffff, #dbeafe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            🏙️
          </div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, display: "flex" }}>Civia</div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 999,
              background: statusColor,
              color: "#fff",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {statusLabel}
          </div>
        </div>

        {/* Tip + sector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
            color: "#bfdbfe",
            fontSize: 26,
          }}
        >
          <span style={{ fontSize: 40 }}>{tipIcon}</span>
          <span style={{ textTransform: "capitalize", display: "flex" }}>{tip}</span>
          {sector && <span style={{ display: "flex" }}>· {sector}</span>}
        </div>

        {/* Title */}
        <div
          style={{
            color: "#fff",
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            marginBottom: 24,
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* Location */}
        {locatie && (
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 26,
              display: "flex",
            }}
          >
            📍 {locatie}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 80,
            right: 80,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(255,255,255,0.7)",
            fontSize: 20,
          }}
        >
          <div style={{ fontFamily: "monospace", display: "flex" }}>#{code}</div>
          <div style={{ display: "flex" }}>civia.ro/sesizari/{code}</div>
        </div>
      </div>
    ),
    size
  );
}
