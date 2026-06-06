import { ImageResponse } from "next/og";
import { createSupabaseAnon } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const alt = "Petiție Civia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface PetitieRow {
  title: string;
  summary: string;
  category: string | null;
  county_code: string | null;
  external_signature_count: number | null;
}

async function getPetitie(slug: string): Promise<PetitieRow | null> {
  try {
    const supabase = createSupabaseAnon();
    const { data } = await supabase
      .from("petitii")
      .select("title, summary, category, county_code, external_signature_count")
      .eq("slug", slug)
      .in("status", ["active", "closed"])
      .maybeSingle();
    return (data as PetitieRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Open Graph image (1200×630) generat la cerere pentru fiecare petiție.
 * Folosit ca fallback când petiția n-are image_url custom — apare în
 * Facebook / X / Bluesky / LinkedIn preview-uri când dai share.
 */
export default async function PetitieOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPetitie(slug);

  const title = p?.title ?? "Petiție civică";
  const summary = p?.summary?.slice(0, 200) ?? "Petiție civică curatată de Civia.";
  const category = p?.category ?? null;
  const county = p?.county_code ?? null;
  const signatures = p?.external_signature_count ?? null;
  const signaturesLabel =
    signatures && signatures > 0 ? signatures.toLocaleString("ro-RO") : null;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #047857 0%, #065f46 50%, #064e3b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "70px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "white",
          position: "relative",
        }}
      >
        {/* Logo C top-left */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 50,
              fontWeight: 600,
              color: "white",
              paddingRight: "10%",
              paddingBottom: "8%",
              lineHeight: 1,
            }}
          >
            C
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Civia
            </span>
            <span style={{ fontSize: 16, opacity: 0.7 }}>
              civia.ro/petitii
            </span>
          </div>
        </div>

        {/* Category + county pill */}
        <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
          {category && (
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                background: "rgba(168, 85, 247, 0.3)",
                color: "#e9d5ff",
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid rgba(168, 85, 247, 0.5)",
              }}
            >
              {category}
            </span>
          )}
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "rgba(255,255,255,0.15)",
              color: "white",
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {county ? `📍 ${county}` : "🇷🇴 Național"}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: 24,
            color: "white",
            // Cap la 3 linii (satori supportă -webkit-box clamp)
            display: "-webkit-box" as never,
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as never,
            overflow: "hidden",
          }}
        >
          {title}
        </h1>

        {/* Semnături — social proof (audit #38). Numărul REAL sincronizat din
            sursă (vezi #5) → cardul de share arată momentum-ul, crește click-ul. */}
        {signaturesLabel && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 22 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: "#a7f3d0" }}>{signaturesLabel}</span>
            <span style={{ fontSize: 24, fontWeight: 600, opacity: 0.85 }}>semnături strânse</span>
          </div>
        )}

        {/* Summary */}
        <p
          style={{
            fontSize: 26,
            lineHeight: 1.4,
            opacity: 0.85,
            margin: 0,
            display: "-webkit-box" as never,
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as never,
            overflow: "hidden",
          }}
        >
          {summary}
        </p>

        {/* Megaphone icon bottom-right + CTA */}
        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: 60,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
            padding: "14px 24px",
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(168, 85, 247, 0.4)",
          }}
        >
          📣 Semnează pe Civia
        </div>
      </div>
    ),
    size,
  );
}
