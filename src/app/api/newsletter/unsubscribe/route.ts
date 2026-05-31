/**
 * GET /api/newsletter/unsubscribe?token=...
 *
 * 1-click unsubscribe (GDPR). Token-based, fără login.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Token lipsă", { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("newsletter_subscriptions")
    .update({ active: false })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();

  if (error || !data) {
    return new Response("Token invalid sau deja dezabonat", { status: 404 });
  }

  return new Response(
    `<!doctype html><html lang="ro"><head><title>Dezabonat</title><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:24px;text-align:center;"><h1>Te-ai dezabonat ✓</h1><p>Nu vei mai primi newsletter-ul săptămânal Civia.</p><p style="margin-top:32px;color:#666;font-size:14px;">Dacă te răzgândești, te poți reabona oricând pe <a href="https://www.civia.ro" style="color:#059669;">civia.ro</a>.</p></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

// POST for List-Unsubscribe=One-Click RFC 8058
export async function POST(req: Request) {
  return GET(req);
}
