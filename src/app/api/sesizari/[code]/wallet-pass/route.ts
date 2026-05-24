import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { SESIZARE_STATUS_META } from "@/lib/sesizari/status";

export const dynamic = "force-dynamic";

/**
 * GET /api/sesizari/[code]/wallet-pass — Apple/Google Wallet pass.
 *
 * (P2.557, P3 deferred — 2026-05-24)
 *
 * Status: JSON template + structură conform pkpass spec.
 * Pentru a fi instalabil pe iOS, JSON-ul trebuie semnat cu certificat
 * Apple Wallet ($99/an). Pentru moment returnăm JSON brut + endpoint
 * funcțional — în Q4 2026 adăugăm semnare.
 *
 * Format pkpass v1: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html
 *
 * Google Wallet (Generic Pass): https://developers.google.com/wallet/generic/web
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const admin = createSupabaseAdmin();
  const { data: sesizare, error } = await admin
    .from("sesizari")
    .select("code, titlu, status, locatie, sector, created_at, tip, sent_at")
    .eq("code", code)
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .maybeSingle();

  if (error || !sesizare) {
    return NextResponse.json({ error: "Sesizare nedisponibilă" }, { status: 404 });
  }

  const statusMeta = SESIZARE_STATUS_META[sesizare.status as keyof typeof SESIZARE_STATUS_META];

  // Apple Wallet pkpass JSON structure (v1)
  const pkpassPayload = {
    formatVersion: 1,
    passTypeIdentifier: "pass.ro.civia.sesizare",
    serialNumber: sesizare.code,
    teamIdentifier: "TODO_APPLE_TEAM_ID", // Trebuie completat la setup
    organizationName: "Civia.ro",
    description: `Sesizare Civia ${sesizare.code}`,
    logoText: "Civia",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(5, 150, 105)", // emerald-600
    labelColor: "rgb(167, 243, 208)", // emerald-200

    // Generic pass type (cel mai flexibil pentru civic use case)
    generic: {
      headerFields: [
        {
          key: "status",
          label: "Stare",
          value: statusMeta?.label ?? sesizare.status,
        },
      ],
      primaryFields: [
        {
          key: "titlu",
          label: "Sesizare",
          value: sesizare.titlu,
        },
      ],
      secondaryFields: [
        {
          key: "code",
          label: "Cod",
          value: sesizare.code,
        },
        {
          key: "locatie",
          label: "Locație",
          value: sesizare.locatie?.slice(0, 50) ?? "—",
        },
      ],
      auxiliaryFields: [
        {
          key: "created",
          label: "Depusă",
          value: new Date(sesizare.created_at).toLocaleDateString("ro-RO"),
        },
        ...(sesizare.sent_at
          ? [
              {
                key: "sent",
                label: "Trimisă",
                value: new Date(sesizare.sent_at).toLocaleDateString("ro-RO"),
              },
            ]
          : []),
      ],
      backFields: [
        {
          key: "tip",
          label: "Tipul problemei",
          value: sesizare.tip,
        },
        {
          key: "details_url",
          label: "Detalii online",
          value: `https://civia.ro/sesizari/${sesizare.code}`,
        },
        {
          key: "civic_info",
          label: "Despre Civia",
          value:
            "Civia urmărește răspunsul primăriei conform OG 27/2002 (30 zile). " +
            "La 60 zile fără răspuns, escaladăm automat la Avocatul Poporului.",
        },
      ],
    },

    barcode: {
      message: `https://civia.ro/sesizari/${sesizare.code}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: sesizare.code,
    },

    // Update endpoint pentru push-notification când status se schimbă
    webServiceURL: `https://civia.ro/api/sesizari/${sesizare.code}/wallet-pass/update`,
    authenticationToken: sesizare.code, // simplu — pkpass spec cere
  };

  return NextResponse.json(
    {
      pkpass: pkpassPayload,
      note:
        "JSON template Apple Wallet/Google Wallet. Pentru instalare reală pe iOS, " +
        "JSON-ul trebuie semnat cu certificat Apple Developer ($99/an). Setup pending Q4 2026.",
      google_wallet_alt:
        "https://pay.google.com/gp/v/save/[ENCODED_JWT] (necesită cont Google Wallet Console + chei JWT)",
      install_status: "json_template_only",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
