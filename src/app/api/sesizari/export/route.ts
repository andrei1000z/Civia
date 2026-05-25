import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

function escapeCsv(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const sector = searchParams.get("sector");
  const tip = searchParams.get("tip");
  const limit = Math.min(Number(searchParams.get("limit") ?? 500), 2000);

  // Rate limit bulk exports: 5 requests per IP per minute
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`export:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return new Response(
      JSON.stringify({ error: "Prea multe cereri. Încearcă în câteva secunde." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = await createSupabaseServer();
    // 2026-05-25 OPTIMIZATION: explicit columns în loc de `.select("*")`.
    // Înainte: 2000 rows × 8 KB (formal_text 2-3KB + imagini + raw_headers
    // toate fetchate inutil) ≈ 16 MB/export. După: ~1 KB/row → 2 MB/export.
    // Salvare ~130 MB/zi Fast Origin Transfer.
    let query = supabase
      .from("sesizari_feed")
      .select(
        "code,created_at,status,tip,sector,county,titlu,locatie,descriere,author_name,voturi_net,nr_comentarii"
      )
      .limit(limit)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (sector) query = query.eq("sector", sector);
    if (tip) query = query.eq("tip", tip);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const header = [
      "cod", "data", "status", "tip", "sector", "titlu", "locatie",
      "descriere", "autor", "voturi_net", "comentarii",
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) => [
        escapeCsv(r.code as string),
        escapeCsv(new Date(r.created_at as string).toISOString().slice(0, 10)),
        escapeCsv(r.status as string),
        escapeCsv(r.tip as string),
        escapeCsv(r.sector as string),
        escapeCsv(r.titlu as string),
        escapeCsv(r.locatie as string),
        escapeCsv(r.descriere as string),
        escapeCsv(r.author_name as string),
        escapeCsv(r.voturi_net as number),
        escapeCsv(r.nr_comentarii as number),
      ].join(",")),
    ].join("\n");

    const filename = `sesizari-${new Date().toISOString().slice(0, 10)}${status ? `-${status}` : ""}${sector ? `-${sector}` : ""}.csv`;
    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
