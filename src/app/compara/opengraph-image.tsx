import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "Compară județele — Civia";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function ComparaOG() {
  return new ImageResponse(
    buildOgCard({
      badge: "Instrument civic",
      title: "Compară județele din România",
      subtitle: "Vezi două județe alăturate: sesizări, populație, aer, siguranță, primari — toate datele într-un singur click.",
      accent: "#0891b2",
      icon: "⚖️",
      metrics: [
        { label: "Județe disponibile", value: "42" },
        { label: "Metrici/comparație", value: "15+" },
        { label: "Date publice", value: "INS + Civia" },
        { label: "Cost", value: "0 lei" },
      ],
    }),
    size
  );
}
