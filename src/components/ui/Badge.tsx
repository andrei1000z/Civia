import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

// 2026-05-24 Faza 3 MINIMALISM: variant set extins cu petition/news/info/error
// pentru a folosi semantic tokens noi (--color-petition, --color-news etc).
// warning/success migrate la token-based pentru consistency dark mode.
export type BadgeVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "warning"
  | "success"
  | "error"
  | "info"
  | "news"
  | "petition";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
  color?: string;
  bgColor?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)]",
  secondary: "bg-[var(--color-secondary-soft)] text-[var(--color-secondary-on-soft)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent-on-soft)]",
  neutral: "bg-[var(--color-surface-2)] text-[var(--color-text)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning-on-soft)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success-on-soft)]",
  error: "bg-[var(--color-error-soft)] text-[var(--color-error-on-soft)]",
  info: "bg-[var(--color-news-soft)] text-[var(--color-news-on-soft)]",
  news: "bg-[var(--color-news-soft)] text-[var(--color-news-on-soft)]",
  petition: "bg-[var(--color-petition-soft)] text-[var(--color-petition-on-soft)]",
};

export function Badge({ children, variant = "neutral", color, bgColor, className, style, ...props }: BadgeProps) {
  const customStyle = color || bgColor
    ? { ...style, color: color, backgroundColor: bgColor }
    : style;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-medium whitespace-nowrap",
        !color && !bgColor && variantStyles[variant],
        className
      )}
      style={customStyle}
      {...props}
    >
      {children}
    </span>
  );
}
