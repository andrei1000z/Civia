"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ShareButton({ code, size = "sm" }: { code: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/sesizari/${code}`;

    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ url, title: `Sesizare ${code}` });
        return;
      } catch {
        // User cancelled — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
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
