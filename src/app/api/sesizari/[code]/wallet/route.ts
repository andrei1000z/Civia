import { NextResponse } from "next/server";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { SESIZARE_TIPURI, STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Apple Wallet / Google Wallet pass endpoint.
 *
 * Apple Wallet (.pkpass) cere PKCS#12 signing cu certificat Apple Developer
 * (necesită cont Apple Developer + Pass Type ID certificate). Nu îl putem
 * livra fără asta.
 *
 * Strategie pe etape:
 *   1. Acum (no cert): returneaza JSON pass.json + instructiuni cum sa-l
 *      genereze offline cu `pkpass` CLI tool, sau redirect la /sesizari/[code]
 *      cu hint pe browser sa „Add to Home Screen" (PWA install).
 *   2. Faza 2: PKCS#12 in env var, semnam .pkpass cu node-pkpass-signer.
 *   3. Google Wallet — JWT signed cu service account → URL direct.
 *
 * Pentru moment, returnam JSON cu structura pass.json + sugestie wallet/PWA.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const sesizare = await getSesizareByCode(code);
  if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!sesizare.publica || sesizare.moderation_status !== "approved") {
    return NextResponse.json({ error: "Sesizare nedisponibila" }, { status: 403 });
  }

  const tipMeta = SESIZARE_TIPURI.find((t) => t.value === sesizare.tip);
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

  // Apple Wallet pass.json schema (eventTicket sau generic). Folosim
  // generic pass care e cel mai flexibil pentru ticket-uri civice.
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: "pass.ro.civia.sesizare",
    serialNumber: sesizare.code,
    teamIdentifier: process.env.APPLE_TEAM_ID || "PLACEHOLDER",
    organizationName: "Civia",
    description: "Sesizare civica - " + sesizare.titlu,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(5, 150, 105)",
    labelColor: "rgb(220, 252, 231)",
    logoText: "Civia",
    barcodes: [
      {
        message: `${SITE_URL}/sesizari/${sesizare.code}`,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: sesizare.code,
      },
    ],
    generic: {
      primaryFields: [
        { key: "code", label: "COD", value: sesizare.code },
      ],
      secondaryFields: [
        { key: "tip", label: "Tip", value: tipMeta?.short ?? sesizare.tip },
        { key: "status", label: "Status", value: STATUS_LABELS[sesizare.status] ?? sesizare.status },
      ],
      auxiliaryFields: [
        { key: "locatie", label: "Locatie", value: sesizare.locatie?.slice(0, 80) ?? "" },
        { key: "created", label: "Trimis", value: new Date(sesizare.created_at).toLocaleDateString("ro-RO") },
      ],
      backFields: [
        {
          key: "url",
          label: "Link",
          value: `${SITE_URL}/sesizari/${sesizare.code}`,
        },
        {
          key: "legal",
          label: "Temei legal",
          value: "OG 27/2002 — autoritatea trebuie sa raspunda in 30 zile.",
        },
      ],
    },
    webServiceURL: `${SITE_URL}/api/wallet`,
    authenticationToken: sesizare.code,
  };

  // Daca nu avem certificat Apple, returnam JSON metadata + instructiuni.
  if (!process.env.APPLE_PASS_CERT_P12 || !process.env.APPLE_TEAM_ID) {
    return NextResponse.json(
      {
        status: "not_signed",
        message:
          `Pass-ul .pkpass semnat necesita certificat Apple Developer. ` +
          `Deocamdata, foloseste „Add to Home Screen" pe iOS Safari pentru ` +
          `a salva sesizarea ca PWA shortcut, sau salveaza link-ul.`,
        share_url: `${SITE_URL}/sesizari/${sesizare.code}`,
        google_wallet_url: null,
        pass_json: passJson,
      },
      { status: 200 },
    );
  }

  // Faza 2 — semnam .pkpass cu node-pkpass-signer (cand certificatul exista).
  // Pana atunci, JSON-ul de mai sus e enough pentru dev + demo.
  return NextResponse.json({ status: "signing_not_implemented", pass_json: passJson });
}
