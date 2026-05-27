/**
 * GET /api/admin/screenshot?url=https://www.civia.ro/...&viewport=mobile|desktop
 *
 * 2026-05-27 — Admin tool: ia screenshot la orice URL prin Cloudflare
 * Browser Rendering API. Util pentru:
 *   - debug UI bugs raportate de useri ("nu se afișează corect pe mobil")
 *   - visual regression check după deploy
 *   - export PDF/PNG pentru reports
 *
 * Auth: admin role required.
 */

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { captureScreenshot } from "@/lib/inbox/screenshot";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) return NextResponse.json({ error: "url required" }, { status: 400 });

  // Whitelist domains (anti-SSRF; nu vrem să screenshot-ăm internal/private).
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  const allowedHosts = [
    "civia.ro", "www.civia.ro",
    "localhost",
    "civia-inbox-handler.musateduardandrei10.workers.dev",
  ];
  if (!allowedHosts.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  const viewport = url.searchParams.get("viewport") === "mobile"
    ? { width: 390, height: 844 }
    : { width: 1920, height: 1080 };

  const { bytes, error } = await captureScreenshot({
    url: targetUrl,
    viewport,
    fullPage: url.searchParams.get("full") === "1",
  });

  if (!bytes) {
    return NextResponse.json({ error: error ?? "screenshot failed" }, { status: 502 });
  }

  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
    },
  });
}
