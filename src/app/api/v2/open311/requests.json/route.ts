import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v2/open311/requests.json — Open311 GeoReport v2 compatible.
 *
 * Spec: http://wiki.open311.org/GeoReport_v2/
 *
 * Permite jurnaliștilor, ONG-urilor și altor civic apps (FixMyStreet RO,
 * vremschimbare.ro, etc.) să consume datele Civia direct.
 *
 * Filtre suportate (subset Open311):
 *   - service_code      → tip
 *   - status            → "open" | "closed"
 *   - start_date        → ISO 8601
 *   - end_date          → ISO 8601
 *   - page              → 1-indexed
 *   - page_size         → max 100
 *
 * Sample:
 *   GET /api/v2/open311/requests.json?status=open&page_size=20
 *
 * Răspunsul respectă schema Open311:
 *   service_request_id, status, status_notes, service_code, service_name,
 *   description, requested_datetime, updated_datetime, address, lat, long,
 *   media_url
 */

const STATUS_MAP_OPEN: string[] = ["nou", "trimis", "inregistrata", "redirectionata", "in-lucru", "actiune-autoritate", "interventie", "amanata"];
const STATUS_MAP_CLOSED: string[] = ["rezolvat", "respins", "ignorat"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const serviceCode = url.searchParams.get("service_code");
  const statusFilter = url.searchParams.get("status"); // "open" | "closed"
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "50", 10)));

  const admin = createSupabaseAdmin();
  let query = admin
    .from("sesizari")
    .select("code, tip, status, titlu, descriere, locatie, lat, lng, imagini, created_at, updated_at, resolved_at")
    .eq("moderation_status", "approved")
    .eq("publica", true)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (serviceCode) query = query.eq("tip", serviceCode);
  if (statusFilter === "open") query = query.in("status", STATUS_MAP_OPEN);
  if (statusFilter === "closed") query = query.in("status", STATUS_MAP_CLOSED);
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requests = (data ?? []).map((s) => {
    const isClosed = STATUS_MAP_CLOSED.includes(s.status);
    const firstMedia = Array.isArray(s.imagini) && s.imagini.length > 0 ? s.imagini[0] : null;
    return {
      service_request_id: s.code,
      status: isClosed ? "closed" : "open",
      status_notes: s.status,
      service_code: s.tip,
      service_name: s.tip,
      description: s.descriere,
      title: s.titlu,
      requested_datetime: s.created_at,
      updated_datetime: s.updated_at,
      resolved_at: s.resolved_at,
      address: s.locatie,
      lat: s.lat,
      long: s.lng,
      media_url: firstMedia,
      // Civia-specific extension — full URL pentru detail page
      detail_url: `https://civia.ro/sesizari/${s.code}`,
    };
  });

  return NextResponse.json(requests, {
    headers: {
      // Cache 5 min — sesizările se actualizează des dar nu instant
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      // CORS — civic apps externe trebuie să poată consume
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Max-Age": "86400",
    },
  });
}
