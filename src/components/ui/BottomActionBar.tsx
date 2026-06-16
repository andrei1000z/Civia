import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * BottomActionBar — bară de acțiune lipită jos, în zona degetului mare (One UI
 * „citește sus, acționează jos"). Pentru acțiunea primară a unui formular/flux
 * pe mobil (Trimite, Confirmă, Semnează). Glass-strong (lc-glass-2) + safe-area.
 * Server-compatible — pune butoanele (client) ca children.
 *
 * Default `mobileOnly` (sm:hidden) — pe desktop acțiunea stă inline în pagină.
 */
export function BottomActionBar({
  children,
  mobileOnly = true,
  className,
}: {
  children: ReactNode;
  /** false → vizibilă și pe desktop. */
  mobileOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 lc-glass-2 border-t border-[var(--color-border)]",
        mobileOnly && "sm:hidden",
        className
      )}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
    >
      <div className="container-narrow flex items-center gap-3 px-4 pt-3">
        {children}
      </div>
    </div>
  );
}
