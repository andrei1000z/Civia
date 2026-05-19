import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "default" | "pill";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** "pill" = full-rounded (radius-full) pentru CTA-uri primare cu vibe One UI.
      "default" = radius-button (8px). Default rămâne 8px backwards-compat. */
  shape?: ButtonShape;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * 2026-05-19 Liquid Civic — variants enhanced with shine + magnetic hover.
 * Primary now uses gradient emerald→aqua. Outline uses refractive border.
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white hover:brightness-110 shadow-md hover:shadow-lg lc-shine lc-magnetic",
  secondary:
    "lc-glass-2 text-[var(--color-text)] lc-glow-hover-aqua lc-magnetic",
  outline:
    "border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary-soft)]",
  ghost:
    "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
  danger:
    "bg-[var(--color-accent)] text-white hover:brightness-110 shadow-md hover:shadow-lg lc-shine",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    shape = "default",
    loading,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        // Phase 3 v2: shape="pill" → radius-full (One UI primary CTA feel).
        // Default rămâne radius-button (8px) backwards-compat.
        "inline-flex items-center justify-center gap-2 font-medium",
        shape === "pill"
          ? "rounded-[var(--radius-full)]"
          : "rounded-[var(--radius-button)]",
        // Tactile micro-bounce pe :active — feel premium pe touch.
        "transition-all duration-200 ease-out whitespace-nowrap active:scale-[0.97] active:duration-75",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        // 2026-05-19: focus ring per variant — primary/danger pe gradient
        // bg au nevoie de outline alb cu offset pe primary background;
        // celelalte (outline/ghost/secondary) pastreaza emerald.
        variant === "primary" || variant === "danger"
          ? "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          : "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : leftIcon ? (
        <span className="flex items-center shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading ? <span className="flex items-center shrink-0">{rightIcon}</span> : null}
    </button>
  );
});
