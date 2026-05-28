export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  // 2026-05-28 — edge runtime Sentry pentru /api routes care folosesc
  // `export const runtime = "edge"` (geocode, ics, authorities).
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  err: { digest?: string },
  _request: { path: string; method: string; headers: Record<string, string> },
  _context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(err);
};
