import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET = "civia-inbox-attachments";

/**
 * 2026-06-07 (audit P1) — proxy admin pentru descărcarea atașamentelor din R2.
 * Obiectele R2 nu sunt publice; adminul are nevoie să vadă PDF-ul real (ex. când
 * OCR-ul a eșuat). Fetch via API-ul Cloudflare (CLOUDFLARE_API_TOKEN), stream la
 * admin. Cheia e validată să înceapă cu „attachments/" (anti path-traversal).
 */
export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key.startsWith("attachments/") || key.includes("..")) {
    return NextResponse.json({ error: "key invalid" }, { status: 400 });
  }

  const acct = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!acct || !token) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 500 });
  }

  const r2 = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acct}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) },
  );
  if (!r2.ok) {
    return NextResponse.json({ error: `R2 fetch ${r2.status}` }, { status: 502 });
  }

  const buf = await r2.arrayBuffer();
  const ct = r2.headers.get("content-type") || "application/octet-stream";
  const filename = key.split("/").pop() ?? "attachment";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `inline; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
