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
 * 5/23/2026 v7 — Liquid Glass (iOS 26 aesthetic) pe toate variantele.
 * `lc-liquid` adaugă backdrop-blur, inset specular highlight, shine pe hover
 * + color-tinted glow. Backgrounds devin semi-transparente pentru ca animated
 * gradient blob-urile din body::before/::after să se vadă PRIN buton (refraction).
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "lc-liquid lc-magnetic bg-gradient-to-br from-emerald-500/85 to-cyan-500/85 text-white font-semibold",
  secondary:
    "lc-liquid lc-liquid-aqua lc-magnetic bg-white/10 text-[var(--color-text)]",
  outline:
    "lc-liquid lc-liquid-slate bg-white/5 border border-[var(--color-primary)]/40 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15",
  ghost:
    "lc-liquid lc-liquid-slate bg-white/5 text-[var(--color-text)]",
  danger:
    "lc-liquid lc-liquid-rose lc-magnetic bg-gradient-to-br from-rose-500/90 to-red-600/90 text-white font-semibold",
};

const sizeStyles: Record<ButtonSize, string> = {
  // 2026-05-24 (P1.152) WCAG 2.2 touch target — sm mobil minimum 40px (h-10)
  // care scade la 36px (h-9) doar de la sm: (≥640px desktop).
  sm: "h-10 sm:h-9 px-3 text-sm",
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
