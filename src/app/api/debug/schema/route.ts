import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * DEV-ONLY: verifies that all migrations have been applied.
 * Returns 404 in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createSupabaseAdmin();
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Check sesizari_feed view columns by fetching one row
  try {
    const { data } = await admin.from("sesizari_feed").select("*").limit(1);
    const row = (data?.[0] ?? {}) as Record<string, unknown>;
    checks["view:sesizari_feed"] = {
      ok: true,
      detail: `columns: ${Object.keys(row).join(", ")}`,
    };
    checks["view:has_resolved_at"] = { ok: "resolved_at" in row };
    checks["view:has_resolved_by_author"] = { ok: "resolved_by_author" in row };
    checks["view:has_resolved_photo_url"] = { ok: "resolved_photo_url" in row };
    checks["view:has_verif_da"] = { ok: "verif_da" in row };
    checks["view:has_verif_nu"] = { ok: "verif_nu" in row };
  } catch (e) {
    checks["view:sesizari_feed"] = {
      ok: false,
      detail: e instanceof Error ? e.message : "unknown error",
    };
  }

  // Check tables exist
  const tables = [
    "sesizare_verifications",
    "newsletter_subscribers",
  ];
  for (const t of tables) {
    try {
      const { error } = await admin.from(t).select("*").limit(0);
      checks[`table:${t}`] = { ok: !error, detail: error?.message };
    } catch (e) {
      checks[`table:${t}`] = {
        ok: false,
        detail: e instanceof Error ? e.message : "unknown",
      };
    }
  }

  // Check profiles.role column
  try {
    const { error } = await admin.from("profiles").select("role").limit(0);
    checks["profiles:role"] = { ok: !error, detail: error?.message };
  } catch (e) {
    checks["profiles:role"] = {
      ok: false,
      detail: e instanceof Error ? e.message : "unknown",
    };
  }

  // Check RPC
  try {
    const { error } = await admin.rpc("sesizari_similare", {
      p_sesizare_id: "00000000-0000-0000-0000-000000000000",
      p_radius_m: 300,
    });
    checks["rpc:sesizari_similare"] = {
      ok: !error,
      detail: error ? error.message : "callable",
    };
  } catch (e) {
    checks["rpc:sesizari_similare"] = {
      ok: false,
      detail: e instanceof Error ? e.message : "unknown",
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({
    ok: allOk,
    checks,
    env: process.env.NODE_ENV,
  });
}
