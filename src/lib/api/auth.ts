import { createHash, randomBytes } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";

export interface ApiKeyAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  keyId?: string;
  ownerId?: string | null;
  scopes?: string[];
  tier?: "free" | "pro";
}

/**
 * Genereaza o cheie noua: prefix vizibil + secret aleator. Cheia originala
 * se returneaza userului O SINGURA DATA; in DB pastram doar SHA-256 hash.
 */
export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("base64url"); // 32 chars urlsafe
  const full = `civia_pk_${secret}`;
  const prefix = full.slice(0, 16);
  const hash = createHash("sha256").update(full).digest("hex");
  return { full, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Valideaza header Authorization sau ?api_key=, check scope, rate-limit.
 * Return { ok: true, ... } sau { ok: false, status, error }.
 */
export async function authenticateApiKey(
  req: Request,
  requiredScope: string,
): Promise<ApiKeyAuthResult> {
  const url = new URL(req.url);
  const headerKey = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    ?.trim();
  const queryKey = url.searchParams.get("api_key");
  const key = headerKey || queryKey;

  if (!key) {
    return {
      ok: false,
      status: 401,
      error: "API key lipsa. Trimite-o ca Authorization: Bearer <key> sau ?api_key=<key>.",
    };
  }

  if (!key.startsWith("civia_pk_") || key.length < 30) {
    return { ok: false, status: 401, error: "API key invalid format." };
  }

  const admin = createSupabaseAdmin();
  const hash = hashApiKey(key);
  const { data: row } = await admin
    .from("api_keys")
    .select("id, owner_id, scopes, tier, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!row) return { ok: false, status: 401, error: "API key invalid." };
  if (row.revoked_at) return { ok: false, status: 403, error: "API key revocata." };

  const scopes: string[] = row.scopes ?? [];
  if (!scopes.includes(requiredScope)) {
    return { ok: false, status: 403, error: `Lipseste scope: ${requiredScope}.` };
  }

  const tier = (row.tier as "free" | "pro") || "free";
  const limit = tier === "pro" ? 1000 : 100;
  const rl = await rateLimitAsync(`api-key:${row.id}`, {
    limit,
    windowMs: 60 * 60_000,
  });
  if (!rl.success) {
    return {
      ok: false,
      status: 429,
      error: `Rate-limit depasit (${limit}/h pentru tier ${tier}).`,
    };
  }

  // Fire-and-forget: update last_used_at + audit row.
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => { /* ignore */ });

  return {
    ok: true,
    status: 200,
    keyId: row.id,
    ownerId: row.owner_id,
    scopes,
    tier,
  };
}

/**
 * Helper pentru a loga apel API in audit table. Async fire-and-forget.
 */
export function logApiCall(
  keyId: string,
  path: string,
  ip: string,
  userAgent: string | null,
  statusCode: number,
): void {
  if (!keyId) return;
  const admin = createSupabaseAdmin();
  const ipHash = createHash("sha256").update(ip + (process.env.AUDIT_SALT ?? "civia")).digest("hex").slice(0, 16);
  admin
    .from("api_key_audit")
    .insert({
      key_id: keyId,
      path: path.slice(0, 200),
      ip_hash: ipHash,
      user_agent: userAgent?.slice(0, 200) ?? null,
      status_code: statusCode,
    })
    .then(() => { /* ignore */ });
}
