import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * POST /api/inbox/heartbeat
 *
 * No-auth diagnostic endpoint. Cloudflare Email Worker pings this
 * BEFORE the main /api/inbox/reply call so we know the Worker is
 * actually firing even if the main webhook fails.
 *
 * Body shape (any JSON ok, we just record it):
 *   { from?, to?, subject?, message_id?, worker_version? }
 *
 * Returns 200 always (best-effort logging).
 */

export async function POST(req: Request) {
  const admin = createSupabaseAdmin();
  const ip = getClientIp(req);

  // Capture headers (selective — skip cookies/auth for size/security)
  const headers: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) {
    const kl = k.toLowerCase();
    if (kl === "cookie" || kl === "authorization") continue;
    headers[k] = v;
  }

  let body: string | null = null;
  try {
    const raw = await req.text();
    body = raw.slice(0, 50_000);
  } catch {
    // ignore
  }

  await admin.from("inbox_debug_log").insert({
    endpoint: "heartbeat",
    source: req.headers.get("user-agent") ?? "unknown",
    http_status: 200,
    request_headers: headers,
    request_body: body,
    source_ip: ip,
  });

  return NextResponse.json({ ok: true, received_at: new Date().toISOString() });
}

export async function GET() {
  // Allow GET as a simple browser ping
  return NextResponse.json({
    ok: true,
    message: "Civia inbox heartbeat endpoint is live. POST to log a heartbeat.",
    timestamp: new Date().toISOString(),
  });
}
