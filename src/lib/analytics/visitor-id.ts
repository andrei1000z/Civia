/**
 * Daily-rotating salted visitor ID — modelul Plausible.
 *
 * Implementare 2026-05-25 ca răspuns la audit Faza 1 #1: localStorage
 * UUID persistent triggera ePrivacy Art. 5(3) → cookie banner necesar.
 * Cu acest model:
 *   - Salt rotează la fiecare 24h și e șters automat din Redis (TTL 26h)
 *   - Raw IP + UA NU se persistă niciodată — folosite doar la derive
 *   - Hash devine ireversibil după rotația salt-ului → outside GDPR
 *
 * Trade-off conștient: NU mai putem să urmărim un user cross-day. Asta
 * e prețul pentru banner-free analytics legal în EU + RO.
 *
 * Sursă: https://plausible.io/blog/legal-assessment-gdpr-eprivacy
 *        https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications
 *
 * Cum se folosește:
 *   const vid = await deriveVisitorId(req);
 *   // vid e un 16-char hex hash, valid 24h. Folosit ca cheie Redis.
 */

import { createHash, randomBytes } from "crypto";
import { analyticsRedis } from "./redis";

/**
 * Cheia Redis pentru salt-ul zilnic. Date-string în UTC ca să fie
 * deterministic indiferent de timezone-ul serverului.
 */
function saltKey(date = new Date()): string {
  return `civia:analytics:salt:${date.toISOString().slice(0, 10)}`;
}

/**
 * Generează un salt random nou de 32 bytes (64 hex chars). Stocat în
 * Redis cu TTL 26h (puțin peste 24h pentru handover smooth la miezul
 * nopții fără gap).
 */
async function fetchOrCreateDailySalt(): Promise<string> {
  if (!analyticsRedis) {
    // Fallback când Redis lipsește — folosim un salt fix din env sau
    // un fixed string (dev only). În production fără Redis n-ar trebui
    // să ajungi aici, dar nu blocăm dev.
    return process.env.ANALYTICS_FALLBACK_SALT || "dev-fallback-salt-unused-in-prod";
  }
  const key = saltKey();
  const existing = await analyticsRedis.get<string>(key);
  if (existing) return existing;
  // Race: două workeri ar putea încerca să seteze în paralel. SET NX
  // garantează că doar primul câștigă; ceilalți iau valoarea existentă.
  const fresh = randomBytes(32).toString("hex");
  const set = await analyticsRedis.set(key, fresh, {
    nx: true,
    ex: 26 * 60 * 60, // 26h — overlap cu ziua următoare ca să nu pierdem evenimente la cusătură
  });
  if (set === "OK") return fresh;
  // NX a respins; alt worker a setat valoarea — recitim-o.
  return (await analyticsRedis.get<string>(key)) || fresh;
}

/**
 * Extrage IP-ul din header-ele standard Vercel + X-Forwarded-For.
 * Nu se persistă niciodată — folosit DOAR ca input la hash și aruncat.
 */
function extractIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0"; // fallback dev / no proxy
}

/**
 * Derivă un visitor ID din contextul cererii.
 *
 * Formula: sha256(salt + host + ip + ua).slice(0, 16)
 *
 * Returns un 16-char hex string. Stable pentru aceeași combinație
 * (ip, ua, host) într-o zi UTC; complet diferit a doua zi (când salt
 * se rotează). User-ul nu poate fi corelat cross-day.
 */
export async function deriveVisitorId(req: Request): Promise<string> {
  const salt = await fetchOrCreateDailySalt();
  const host = (req.headers.get("host") || "civia.ro").toLowerCase();
  const ip = extractIp(req);
  const ua = (req.headers.get("user-agent") || "").slice(0, 500);

  // Hash + truncate. 16 hex chars = 64 bits entropie, suficient să eviți
  // coliziuni statistice la milioane de useri/zi. Length consistent cu
  // formatul vechi `v-XXXXXXXX` ca să nu spargem dashboard-ul.
  const hash = createHash("sha256")
    .update(salt)
    .update(host)
    .update(ip)
    .update(ua)
    .digest("hex");
  return hash.slice(0, 16);
}

/**
 * Test helper — forțează folosirea unui salt fix. Nu apela în production.
 * @internal
 */
export function __resetSaltCache(): void {
  // No-op în versiunea curentă; Redis e single source of truth.
  // Lasat aici ca să match cu pattern-ul test setup.
}
