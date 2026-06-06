import { ImageResponse } from "next/og";
import { createSupabaseAnon } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const alt = "Protest Civia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ProtestRow {
  title: string;
  subtitle: string | null;
  city: string | null;
  location_name: string | null;
  start_at: string | null;
  status: string | null;
  expected_attendance: number | null;
}

async function getProtest(slug: string): Promise<ProtestRow | null> {
  try {
    const supabase = createSupabaseAnon();
    const { data } = await supabase
      .from("proteste")
      .select("title, subtitle, city, location_name, start_at, status, expected_attendance")
      .eq("slug", slug)
      .eq("visibility", "publica")
      .maybeSingle();
    return (data as ProtestRow | null) ?? null;
  } catch {
    return null;
  }
}

function formatWhen(iso: string): string | null {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = {
  planificat: "📅 Planificat",
  in_desfasurare: "🔴 În desfășurare",
  incheiat: "✓ Încheiat",
  anulat: "✕ Anulat",
};

/**
 * Open Graph image (1200×630) generat la cerere pentru fiecare protest (audit
 * #38). Înainte: proteste N-aveau OG image → share pe social = preview fără card
 * → click redus. Acum: card cu titlu + dată + locație + status + participanți.
 */
export default async function ProtestOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProtest(slug);

  const title = p?.title ?? "Protest civic";
  const subtitle = p?.subtitle?.slice(0, 150) ?? null;
  const city = p?.city ?? null;
  const location = p?.location_name ?? null;
  const when = p?.start_at ? formatWhen(p.start_at) : null;
  const status = p?.status ? STATUS_LABEL[p.status] ?? null : null;
  const attendance =
    p?.expected_attendance && p.expected_attendance > 0
      ? p.expected_attendance.toLocaleString("ro-RO")
      : null;
  const whereLine = [city, location].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 50%, #450a0a 100%)",
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
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)",
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
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Civia</span>
            <span style={{ fontSize: 16, opacity: 0.7 }}>civia.ro/proteste</span>
          </div>
        </div>

        {/* Status + when pills */}
        <div style={{ display: "flex", gap: 10, marginBottom: 26, flexWrap: "wrap" }}>
          {status && (
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                background: "rgba(255,255,255,0.16)",
                color: "white",
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {status}
            </span>
          )}
          {when && (
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                background: "rgba(0,0,0,0.25)",
                color: "white",
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              🗓️ {when}
            </span>
          )}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 62,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            marginBottom: 18,
            color: "white",
            display: "-webkit-box" as never,
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as never,
            overflow: "hidden",
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
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
            {subtitle}
          </p>
        )}

        {/* Where line (bottom-left) */}
        {whereLine && (
          <div
            style={{
              position: "absolute",
              left: 80,
              bottom: 64,
              display: "flex",
              alignItems: "center",
              fontSize: 24,
              fontWeight: 600,
              opacity: 0.9,
              maxWidth: 720,
            }}
          >
            📍 {whereLine}
          </div>
        )}

        {/* CTA bottom-right */}
        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "linear-gradient(135deg, #f87171 0%, #b91c1c 100%)",
            padding: "14px 24px",
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(185, 28, 28, 0.5)",
          }}
        >
          {attendance ? `📣 ${attendance} așteptați` : "📣 Vezi pe Civia"}
        </div>
      </div>
    ),
    size,
  );
}
