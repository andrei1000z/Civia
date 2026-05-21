import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** Display name pentru initials fallback. „Andrei Popescu" → „AP". */
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_PX: Record<NonNullable<AvatarProps["size"]>, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

const SIZE_TEXT: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "text-[9px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-xl",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

// Deterministic color per name — same name → same color (consistent UX).
// Picked from Civia palette tokens (emerald/blue/violet/amber/rose/cyan).
const FALLBACK_PALETTE = [
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Avatar — shared user-avatar primitive cu fallback la initials colorate
 * determinist (acelasi nume → aceleasi culori, cross-session).
 *
 * Usage:
 *   <Avatar src={profile.avatar_url} name={profile.display_name} size="sm" />
 *   <Avatar name="Andrei Popescu" />  // initials „AP" pe bg verde
 */
export function Avatar({ src, alt, name, size = "md", className }: AvatarProps) {
  const px = SIZE_PX[size];
  const initials = getInitials(name);
  const paletteIdx = name ? hashName(name) % FALLBACK_PALETTE.length : 0;
  const fallbackBg = FALLBACK_PALETTE[paletteIdx]!;

  if (src) {
    return (
      <span
        className={cn(
          "relative inline-block rounded-full overflow-hidden shrink-0 bg-[var(--color-surface-2)]",
          className,
        )}
        style={{ width: px, height: px }}
      >
        <Image
          src={src}
          alt={alt ?? name ?? "Avatar"}
          width={px}
          height={px}
          className="object-cover"
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
        fallbackBg,
        SIZE_TEXT[size],
        className,
      )}
      style={{ width: px, height: px }}
      aria-label={alt ?? name ?? "Avatar"}
      role="img"
    >
      {initials}
    </span>
  );
}
