import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

// Edge runtime — ImageResponse + buildOgCard sunt pure JSX, no Node deps.
// Crawlerele social cer OG image rapid, altfel folosesc fallback.
export const runtime = "edge";
export const alt = "Petiții civice cu impact real — Civia";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function PetitiiOG() {
  return new ImageResponse(
    buildOgCard({
      badge: "Petiții civice",
      title: "Petiții civice cu impact real",
      subtitle:
        "Semnează petiții curate din România sau inițiază propria cauză. Mai multe voci înseamnă presiune mai mare pe autorități.",
      accent: "#7C3AED",
      icon: "✍️",
      metrics: [
        { label: "Acțiune", value: "semnează" },
        { label: "Surse", value: "curate" },
        { label: "Cost", value: "gratuit" },
        { label: "Impact", value: "real" },
      ],
    }),
    size,
  );
}
