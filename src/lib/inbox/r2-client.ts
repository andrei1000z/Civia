/**
 * Cloudflare R2 client pentru atașamente email primite.
 *
 * 2026-05-27 — Worker civia-inbox-handler încarcă atașamente în bucket
 * civia-inbox-attachments cu R2 binding direct. Backend-ul Vercel
 * folosește S3-compatible API ca să fetch-uiască conținutul pentru
 * extracție (unpdf, Gemini Vision, mammoth).
 *
 * Bucket: civia-inbox-attachments (jurisdicție EU)
 * Lifecycle: auto-delete obiecte mai vechi de 90 zile
 * Access: privat, doar via signed URLs sau API token
 *
 * ENV vars necesare:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * R2 endpoint format: https://{account_id}.eu.r2.cloudflarestorage.com
 * (jurisdicție EU — date stocate în UE, GDPR-safe)
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    // Lipsește configurarea — în dev mode acceptăm absența, în prod va
    // emite warning în Sentry când e accesat. NU throwăm aici ca să nu
    // breakuim moduli care nu folosesc R2 (ex: tests).
    return null;
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

/**
 * Fetch un obiect din R2 ca Uint8Array (pentru pass la extractors).
 * Returns null pe orice eroare (network, 404, auth) — caller-ul decide
 * cum să degradeze.
 */
export async function fetchR2Object(key: string): Promise<Uint8Array | null> {
  const client = getR2Client();
  if (!client) return null;
  const bucket = process.env.R2_BUCKET_NAME || "civia-inbox-attachments";
  try {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const res = await client.send(cmd);
    if (!res.Body) return null;
    // @aws-sdk/client-s3 returns Body as ReadableStream-like;
    // transformToByteArray e disponibil pe Node 18+.
    const bytes = await res.Body.transformToByteArray();
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Helper pentru testing — verifică dacă R2 e configurat fără să
 * încercăm un fetch real. Folosit la /admin/inbox UI pentru a afișa
 * warning dacă variabilele lipsesc.
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}
