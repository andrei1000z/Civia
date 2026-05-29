"use client";

import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  /** Surface name (e.g. "sesizari", "petitii", "admin") — tag-uit in Sentry */
  surface: string;
  /** Fallback UI cand erorile sunt prinse */
  fallback?: ReactNode;
  /** Children to wrap */
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary tagged per surface pentru Sentry diagnostics.
 *
 * Inainte: erorile React unhandled aterizau toate sub `unknown` tag in Sentry
 * → hard de prioritizat. Acum: fiecare surface (sesizari, petitii, stiri,
 * admin, etc.) are tag distinct → grouping + alerts per surface.
 *
 * Usage:
 *   <TaggedErrorBoundary surface="sesizari">
 *     <SesizariContent />
 *   </TaggedErrorBoundary>
 *
 * Sau in app/route-group/error.tsx Next.js:
 *   export default function Error(...) { ... cu surface tag }
 */
export class TaggedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    Sentry.captureException(error, {
      tags: { surface: this.props.surface },
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="container-narrow py-12 text-center">
            <h2 className="text-xl font-bold mb-2">Ceva nu a mers bine</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Eroarea a fost raportată automat. Reîncarcă pagina sau încearcă mai târziu.
            </p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
