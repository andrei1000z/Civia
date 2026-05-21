import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

// Edge runtime — ImageResponse + buildOgCard sunt pure JSX, no Node deps.
// Cold start ~40ms vs ~200ms Node Lambda. Important: Twitter / Facebook
// crawlerele cer OG image rapid altfel folosesc fallback.
export const runtime = "edge";
export const alt = "Știri civice România — Civia";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function StiriOG() {
  return new ImageResponse(
    buildOgCard({
      badge: "Știri agregate",
      title: "Știri civice din România",
      subtitle: "Știri din 12 surse verificate: transport, urbanism, mediu, siguranță, administrație — grupate pe județe.",
      accent: "#1C4ED8",
      icon: "📰",
      metrics: [
        { label: "Surse", value: "12+" },
        { label: "Actualizare", value: "zilnic" },
        { label: "Categorii", value: "6" },
        { label: "Per județ", value: "da" },
      ],
    }),
    size
  );
}
