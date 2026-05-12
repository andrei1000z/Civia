import { ImageResponse } from "next/og";
import { getCountyBySlug, ALL_COUNTIES } from "@/data/counties";

// Node runtime — the county lookup uses a plain JS import which can't run
// in edge. One PNG per county, generated statically.
export const runtime = "nodejs";
export const alt = "Civia — platformă civică pe județul tău";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Without an explicit generateStaticParams on this file, Next.js tries to
// probe the route with an undefined `judet` at collect-page-data time and
// `getCountyBySlug` crashes on `.toLowerCase()`. We mirror the county list
// that [judet]/page.tsx already prerenders.
export function generateStaticParams() {
  return ALL_COUNTIES.map((c) => ({ judet: c.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ judet: string }> }) {
  const { judet } = await params;
  const county = judet ? getCountyBySlug(judet) : undefined;
  const name = county?.name ?? "România";

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
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "linear-gradient(135deg, #ffffff, #dbeafe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            🏛️
          </div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>Civia</div>
        </div>

        <div style={{ display: "flex", color: "#86efac", fontSize: 26, fontWeight: 500, marginBottom: 8, letterSpacing: 2, textTransform: "uppercase" }}>
          Județul
        </div>

        <div
          style={{
            display: "flex",
            color: "#fff",
            fontSize: 128,
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: -3,
            marginBottom: 28,
          }}
        >
          {name}
        </div>

        <div style={{ display: "flex", color: "#bfdbfe", fontSize: 30, fontWeight: 400, maxWidth: 1040, lineHeight: 1.3 }}>
          Sesizări, calitate aer, întreruperi și ghiduri civice — toate dintr-un singur loc.
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
            <span>🌬️ Aer live</span>
            <span>⚠️ Întreruperi</span>
            <span>📰 Știri locale</span>
          </div>
          <div style={{ display: "flex" }}>{`civia.ro/${county?.slug ?? "ro"}`}</div>
        </div>
      </div>
    ),
    size
  );
}
