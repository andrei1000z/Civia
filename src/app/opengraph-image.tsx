import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Civia — Platforma civică a Bucureștiului";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #059669 0%, #047857 50%, #0a0a0a 100%)",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "linear-gradient(135deg, #ffffff, #dbeafe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            🏙️
          </div>
          <div style={{ color: "#fff", fontSize: 32, fontWeight: 700 }}>Civia</div>
        </div>

        <div
          style={{
            color: "#fff",
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: 900,
            letterSpacing: -2,
            marginBottom: 24,
          }}
        >
          București, mai ușor de înțeles.
        </div>

        <div style={{ color: "#bfdbfe", fontSize: 32, fontWeight: 400, maxWidth: 1000 }}>
          Sesizări, petiții, ghiduri, calitate aer și știri — într-un singur loc.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            right: 80,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(255,255,255,0.7)",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            <span>📮 Sesizări</span>
            <span>✍️ Petiții</span>
            <span>🌬️ Calitate aer</span>
          </div>
          <div>civia.ro</div>
        </div>
      </div>
    ),
    size
  );
}
