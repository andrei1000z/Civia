"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ShareButton({
  code,
  title,
  size = "sm",
}: {
  code: string;
  title?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  // 2026-06-24 — ShareButton NU trackuia deloc (share-uri din carduri =
  // invizibile în analytics → „1 share" era artefact de măsurare). Plus
  // share-ul nativ trimitea doar titlu, fără îndemn → link sec pe WhatsApp.
  const trackShare = (channel: string, url: string) => {
    import("@/components/analytics/CiviaTracker")
      .then(({ trackCustomEvent }) => trackCustomEvent("share", { channel, url, source: "listing-card" }))
      .catch(() => { /* silent */ });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/sesizari/${code}`;
    const text = title
      ? `Sesizare pe Civia: „${title}". Vezi și trimite și tu 👇`
      : "Vezi sesizarea pe Civia 👇";

    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "Civia — sesizare", text });
        trackShare("native", url);
        return;
      } catch {
        // User cancelled — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      trackShare("clipboard", url);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: prompt
      window.prompt("Copiază link-ul:", url);
    }
  };

  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Button
      type="button"
      variant={copied ? "primary" : "secondary"}
      size={size}
      onClick={handleShare}
      aria-live="polite"
      aria-label={copied ? "Link copiat în clipboard" : "Distribuie sesizarea"}
      leftIcon={
        copied ? (
          <Check size={iconSize} aria-hidden="true" />
        ) : (
          <Share2 size={iconSize} aria-hidden="true" />
        )
      }
    >
      <span>{copied ? "Copiat" : "Distribuie"}</span>
    </Button>
  );
}
