"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI — default = card with reload button. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional section name for Sentry tags. */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Section-level error boundary — wrap individual page sections to prevent
 * a single component crash from killing the entire page.
 *
 * Reports to Sentry with optional section tag. Provides reset action.
 *
 * Usage:
 *   <ErrorBoundary section="sesizari-feed">
 *     <SesizariList />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      tags: {
        kind: "react_error_boundary",
        section: this.props.section ?? "unknown",
      },
      extra: { componentStack: errorInfo.componentStack ?? "" },
    });
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          role="alert"
          className="bg-[var(--color-surface)] border border-amber-200 dark:border-amber-900 rounded-[var(--radius-md)] p-5 my-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[var(--color-text)] mb-1">
                Ceva s-a stricat pe această secțiune
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
                Restul paginii funcționează normal. Reîncearcă sau refresh pagina.
              </p>
              <button
                type="button"
                onClick={this.reset}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                <RefreshCw size={12} aria-hidden="true" />
                Încearcă din nou
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
