import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  accentColor?: string;
  /** 2026-05-19 Liquid Civic — glass variants. */
  variant?: "solid" | "glass" | "glass-strong" | "flat";
}

export function Card({ children, hover, accentColor, variant = "solid", className, ...props }: CardProps) {
  const variantClass =
    variant === "glass" ? "lc-glass-2"
    : variant === "glass-strong" ? "lc-glass-3 lc-glow-emerald"
    : variant === "flat" ? "bg-[var(--color-surface)] border border-[var(--color-border)]"
    : "bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-2)]";

  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-md)] p-4 sm:p-5",
        variantClass,
        "transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        hover && variant !== "glass-strong" && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/40 active:translate-y-0 active:duration-75",
        hover && (variant === "glass" || variant === "glass-strong") && "lc-magnetic hover:lc-glow-emerald",
        accentColor && "border-l-4",
        className
      )}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-3", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-lg font-semibold text-[var(--color-text)] font-[family-name:var(--font-sora)]", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-[var(--color-text-muted)]", className)}>{children}</p>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-sm text-[var(--color-text)]", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between", className)}>
      {children}
    </div>
  );
}
