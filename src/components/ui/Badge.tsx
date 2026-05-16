import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "primary" | "secondary" | "accent" | "neutral" | "warning" | "success";

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
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
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
