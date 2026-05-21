import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";
import { ghiduri } from "@/data/ghiduri";

// Edge runtime — static data + pure JSX. -150ms cold start.
export const runtime = "edge";
export const alt = "Ghiduri civice România — Civia";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function GhiduriOG() {
  return new ImageResponse(
    buildOgCard({
      badge: "Ghiduri practice",
      title: "Ghiduri civice pentru cetățeni",
      subtitle: "Legea 544, contestare amendă, ajutoare sociale, ONG, drepturi — ghiduri pas cu pas, scrise de cetățeni pentru cetățeni.",
      accent: "#8b5cf6",
      icon: "📚",
      metrics: [
        { label: "Ghiduri", value: String(ghiduri.length) },
        { label: "Legi explicate", value: "5+" },
        { label: "Modele cereri", value: "10+" },
        { label: "Cost", value: "0 lei" },
      ],
    }),
    size
  );
}
