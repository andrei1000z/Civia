import { ImageResponse } from "next/og";
import {
  getInterruptionById,
  TYPE_COLORS,
  TYPE_ICONS,
  TYPE_LABELS,
} from "@/data/intreruperi";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Întrerupere programată — Civia";

// 2026-06-05 — render OG on-demand (nu pre-randa sute de imagini la build →
// build mai rapid + fără timeout). Crawler-ele social le cer la nevoie.
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getInterruptionById(id);
  if (!item) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            color: "#64748b",
          }}
        >
          Întrerupere — Civia
        </div>
      ),
      { ...size },
    );
  }

  const color = TYPE_COLORS[item.type];
  const emoji = TYPE_ICONS[item.type];
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  const dateFmt = new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
          display: "flex",
          flexDirection: "column",
          padding: 72,
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: "white",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
            }}
          >
            {emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.9 }}>Civia</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{TYPE_LABELS[item.type]}</span>
          </div>
        </div>

        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 20,
            maxWidth: 1050,
          }}
        >
          {item.reason}
        </h1>

        <p style={{ fontSize: 28, opacity: 0.92, maxWidth: 1050, marginBottom: 32 }}>
          📍 {item.addresses.slice(0, 2).join(" · ")}
          {item.addresses.length > 2 ? ` + ${item.addresses.length - 2} adrese` : ""}
        </p>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 24,
            background: "rgba(0,0,0,0.25)",
            padding: "20px 28px",
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 600 }}>
            🕒 {dateFmt.format(start)} — {dateFmt.format(end)}
          </span>
          {item.affectedPopulation != null && item.affectedPopulation > 0 && (
            <span style={{ fontSize: 22, fontWeight: 600 }}>
              👥 ~{item.affectedPopulation.toLocaleString("ro-RO")} pers.
            </span>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
