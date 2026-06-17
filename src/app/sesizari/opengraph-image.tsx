import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

// Edge runtime — ImageResponse + buildOgCard sunt pure JSX, no Node deps.
// Crawlerele social cer OG image rapid, altfel folosesc fallback.
export const runtime = "edge";
export const alt = "Trimite o sesizare formală — Civia";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function SesizariOG() {
  return new ImageResponse(
    buildOgCard({
      badge: "Sesizări civice",
      title: "Trimite o sesizare formală în 90 de secunde",
      subtitle:
        "Fă o poză, descrie problema — AI-ul construiește sesizarea oficială către autoritatea potrivită, cu temei legal OG 27/2002.",
      accent: "#059669",
      icon: "📸",
      metrics: [
        { label: "Durată", value: "90 sec" },
        { label: "Cost", value: "gratuit" },
        { label: "Temei", value: "OG 27/2002" },
        { label: "Răspuns", value: "30 zile" },
      ],
    }),
    size,
  );
}
