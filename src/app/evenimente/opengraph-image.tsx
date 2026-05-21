import { ImageResponse } from "next/og";
import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-helpers";
import { evenimente } from "@/data/evenimente";

// Edge runtime — static data + pure JSX. Cold start ~40ms vs ~200ms Node.
export const runtime = "edge";
export const alt = "Evenimente majore România — Civia";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function EvenimenteOG() {
  const total = evenimente.length;
  const critice = evenimente.filter((e) => e.severity === "critic").length;
  return new ImageResponse(
    buildOgCard({
      badge: "Istorie civică",
      title: "Evenimente majore din România",
      subtitle: "Explozii, incendii, inundații, cutremure, proteste — documentate cu timeline, cauze și impact.",
      accent: "#dc2626",
      icon: "📌",
      metrics: [
        { label: "Evenimente", value: String(total) },
        { label: "Categorii", value: "6" },
        { label: "Severitate critică", value: String(critice) },
        { label: "Timeline", value: "1977→" },
      ],
    }),
    size
  );
}
