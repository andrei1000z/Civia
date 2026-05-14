import { ImageResponse } from "next/og";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { SESIZARE_TIPURI } from "@/lib/constants";

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
  const tipLabel = SESIZARE_TIPURI.find((t) => t.value === tip)?.label ?? "Sesizare civică";

  // Foloseste prima imagine a sesizarii ca background — face share card-ul
  // sa para o stire reala, nu un template generic. Daca lipseste, fallback
  // la un gradient bogat (nu plat).
  const photo = sesizare?.imagini?.[0] ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "system-ui",
          background: photo
            ? "#0a0a0a"
            : "linear-gradient(135deg, #042f2e 0%, #0e7c66 45%, #064e3b 100%)",
        }}
      >
        {/* Background image — poza sesizarii cu dark overlay pentru lizibilitate */}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(2px) brightness(0.55)",
            }}
          />
        )}
        {/* Gradient overlay — sus mai transparent, jos negru pentru contrast text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: photo
              ? "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.85) 100%)"
              : "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.25) 100%)",
          }}
        />

        {/* Content layer */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            padding: "60px 72px",
          }}
        >
          {/* Header: brand + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: -1,
                boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)",
              }}
            >
              C
            </div>
            <div
              style={{
                color: "#fff",
                fontSize: 26,
                fontWeight: 700,
                display: "flex",
                letterSpacing: -0.5,
              }}
            >
              Civia
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                padding: "8px 18px",
                borderRadius: 999,
                background: statusColor,
                color: "#fff",
                fontSize: 18,
                fontWeight: 600,
                boxShadow: `0 6px 18px ${statusColor}55`,
              }}
            >
              {statusLabel}
            </div>
          </div>

          {/* Push content to bottom-third for poster-style hierarchy */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Tip pill */}
          <div style={{ display: "flex", marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.22)",
                color: "#fff",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              {tipLabel}
              {sector && (
                <span style={{ display: "flex", marginLeft: 10, opacity: 0.7 }}>
                  · {sector}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              color: "#fff",
              fontSize: title.length > 60 ? 54 : 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.8,
              marginBottom: 20,
              display: "flex",
              maxWidth: "92%",
              textShadow: photo ? "0 2px 12px rgba(0,0,0,0.4)" : "none",
            }}
          >
            {title}
          </div>

          {/* Location */}
          {locatie && (
            <div
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ display: "flex" }}>📍</span>
              <span style={{ display: "flex" }}>{locatie}</span>
            </div>
          )}

          {/* Footer: code + URL + CTA */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 36,
              paddingTop: 20,
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: "rgba(255,255,255,0.7)",
                fontSize: 18,
              }}
            >
              <span style={{ fontFamily: "monospace", display: "flex" }}>#{code}</span>
              <span style={{ display: "flex" }}>civia.ro</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 20px",
                borderRadius: 999,
                background: "#fff",
                color: "#042f2e",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: -0.2,
              }}
            >
              Co-semnează →
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
