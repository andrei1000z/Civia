import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";

/**
 * Wrap an API route handler with consistent error capture + reporting.
 *
 * Replaces the boilerplate try/catch + Sentry.captureException + Zod
 * fallthrough that every route used to repeat. Drop-in for any route
 * that doesn't need custom error shaping.
 *
 * Usage:
 *   export const POST = withApiHandler(async (req) => {
 *     // ...your logic, throw freely
 *     return NextResponse.json({ data });
 *   }, { name: "sesizari.create" });
 *
 * Error responses:
 *   - ZodError → 400 + first issue (path + message)
 *   - Error with .status → that status + .message
 *   - Anything else → 500 + generic message, Sentry-captured
 */
export interface ApiHandlerOptions {
  /** Sentry tag for grouping (e.g., "sesizari.create"). */
  name: string;
  /** Override the default generic 500 message shown to users. */
  fallbackMessage?: string;
}

export function withApiHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
  opts: ApiHandlerOptions,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        const msg = issue?.message ?? "Date invalide";
        const field = issue?.path.join(".");
        return NextResponse.json(
          { error: `${msg}${field ? ` (${field})` : ""}`, details: e.issues },
          { status: 400 },
        );
      }

      // Treat .status as an HTTP status if numeric — used by helpers
      // that throw `Object.assign(new Error(...), { status: 401 })`.
      const status = typeof (e as { status?: unknown }).status === "number"
        ? ((e as { status: number }).status)
        : 500;

      // Only Sentry-capture true 500s — 4xx errors are user-driven and
      // already visible in the response body.
      if (status >= 500) {
        Sentry.captureException(e, { tags: { route: opts.name } });
      }

      const message = e instanceof Error ? e.message : opts.fallbackMessage ?? "Eroare server";
      return NextResponse.json({ error: message }, { status });
    }
  };
}
