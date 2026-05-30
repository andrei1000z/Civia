/**
 * Cloudflare D1 client — wrapper care imita API @upstash/redis pentru
 * analyticsRedis-ul Civia.
 *
 * 2026-05-31 — Replacement pentru Upstash (suspendat billing failure).
 * D1 free tier: 5M reads/zi + 100k writes/zi + 5GB storage. Civia consumă
 * ~73k req/zi (post-sampling -80%) → fit confortabil cu 27k buffer.
 *
 * Schema D1 (5 tabele):
 *   - kv         : key → value (SET/GET/DEL/EXPIRE)
 *   - hash_kv    : key + field → value (HGET/HSET/HINCRBY/HGETALL)
 *   - set_kv     : key + member (SADD/SISMEMBER/SCARD/SREM)
 *   - list_kv    : key + id + value (LPUSH/LRANGE/LTRIM)
 *   - zset_kv    : key + member + score (ZADD/ZRANGE/ZCARD/ZINCRBY)
 *
 * TTL: coloana expires_at INTEGER (unix ms). Cleanup pe demand la read,
 * plus cron worker batch DELETE WHERE expires_at < now.
 *
 * Toate calls async, batch pe pipeline.exec() pentru reduce calls D1.
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "998276877f06ec89b465c40c309e89fc";
const CF_D1_DB_ID = process.env.CLOUDFLARE_D1_DB_ID || "44b8fe3d-761f-40a0-b61b-f2fdc53a693b";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN_D1 || process.env.CLOUDFLARE_API_TOKEN || "";

const D1_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DB_ID}`;

const NOW = () => Date.now();

interface D1Response<T = unknown> {
  success: boolean;
  result?: Array<{
    results?: T[];
    meta?: { rows_read?: number; rows_written?: number; changes?: number };
    success?: boolean;
  }>;
  errors?: Array<{ code: number; message: string }>;
}

interface D1QueryBody {
  sql: string;
  params?: Array<string | number | null>;
}

async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: Array<string | number | null> = [],
): Promise<T[]> {
  if (!CF_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN missing");
  }
  const res = await fetch(`${D1_API_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params } as D1QueryBody),
  });
  const json = (await res.json()) as D1Response<T>;
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "D1 query failed";
    throw new Error(`D1: ${msg}`);
  }
  return (json.result?.[0]?.results ?? []) as T[];
}

async function d1Exec(sql: string, params: Array<string | number | null> = []): Promise<void> {
  await d1Query(sql, params);
}

async function d1Batch(stmts: Array<{ sql: string; params?: Array<string | number | null> }>): Promise<void> {
  if (stmts.length === 0) return;
  if (!CF_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN missing");
  // D1 supports POST /raw cu array de statement-uri sau folosim batch via Worker only.
  // Via REST API: batch endpoint accepta array of {sql, params}.
  const res = await fetch(`${D1_API_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(stmts),
  });
  const json = (await res.json()) as D1Response;
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "D1 batch failed";
    throw new Error(`D1 batch: ${msg}`);
  }
}

const TTL_FILTER = "AND (expires_at IS NULL OR expires_at > ?)";

// ─── Redis-compatible API ────────────────────────────────────────────────────

export class CiviaD1Client {
  // ─── Keys / Strings ──────────────────────────────────────────────────────
  async get<T = string>(key: string): Promise<T | null> {
    const rows = await d1Query<{ v: string }>(
      `SELECT v FROM kv WHERE k = ? ${TTL_FILTER} LIMIT 1`,
      [key, NOW()],
    );
    return (rows[0]?.v ?? null) as T | null;
  }

  async set(
    key: string,
    value: string | number,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<"OK" | null> {
    const expires = opts?.ex ? NOW() + opts.ex * 1000 : null;
    const v = typeof value === "number" ? String(value) : value;
    if (opts?.nx) {
      // INSERT ... ON CONFLICT DO NOTHING — return null daca exista deja
      const result = await d1Query<{ inserted: number }>(
        `INSERT INTO kv (k, v, expires_at) VALUES (?, ?, ?) ON CONFLICT(k) DO NOTHING RETURNING 1 AS inserted`,
        [key, v, expires],
      );
      return result.length > 0 ? "OK" : null;
    }
    await d1Exec(
      `INSERT INTO kv (k, v, expires_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, expires_at = excluded.expires_at`,
      [key, v, expires],
    );
    return "OK";
  }

  async del(key: string): Promise<number> {
    const rows = await d1Query<{ ok: number }>(
      `DELETE FROM kv WHERE k = ? RETURNING 1 AS ok`,
      [key],
    );
    return rows.length;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const expires = NOW() + seconds * 1000;
    // Apply TTL to all storage tables (we don't know which one stores the key)
    await d1Batch([
      { sql: `UPDATE kv SET expires_at = ? WHERE k = ?`, params: [expires, key] },
      { sql: `UPDATE hash_kv SET expires_at = ? WHERE k = ?`, params: [expires, key] },
      { sql: `UPDATE set_kv SET expires_at = ? WHERE k = ?`, params: [expires, key] },
      { sql: `UPDATE list_kv SET expires_at = ? WHERE k = ?`, params: [expires, key] },
      { sql: `UPDATE zset_kv SET expires_at = ? WHERE k = ?`, params: [expires, key] },
    ]);
    return 1;
  }

  // ─── Hash ────────────────────────────────────────────────────────────────
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    const rows = await d1Query<{ v: string }>(
      `SELECT v FROM hash_kv WHERE k = ? AND f = ? ${TTL_FILTER} LIMIT 1`,
      [key, field, NOW()],
    );
    return (rows[0]?.v ?? null) as T | null;
  }

  async hgetall<T extends Record<string, unknown> = Record<string, string>>(
    key: string,
  ): Promise<T | null> {
    const rows = await d1Query<{ f: string; v: string }>(
      `SELECT f, v FROM hash_kv WHERE k = ? ${TTL_FILTER}`,
      [key, NOW()],
    );
    if (rows.length === 0) return null;
    const out: Record<string, string> = {};
    for (const row of rows) out[row.f] = row.v;
    return out as unknown as T;
  }

  async hset(key: string, fieldsOrField: Record<string, string | number> | string, value?: string | number): Promise<number> {
    let entries: Array<[string, string]>;
    if (typeof fieldsOrField === "string") {
      entries = [[fieldsOrField, String(value ?? "")]];
    } else {
      entries = Object.entries(fieldsOrField).map(([f, v]) => [f, String(v)]);
    }
    if (entries.length === 0) return 0;
    const stmts = entries.map(([f, v]) => ({
      sql: `INSERT INTO hash_kv (k, f, v) VALUES (?, ?, ?) ON CONFLICT(k, f) DO UPDATE SET v = excluded.v`,
      params: [key, f, v] as Array<string | number | null>,
    }));
    await d1Batch(stmts);
    return entries.length;
  }

  async hsetnx(key: string, field: string, value: string | number): Promise<number> {
    const rows = await d1Query<{ inserted: number }>(
      `INSERT INTO hash_kv (k, f, v) VALUES (?, ?, ?) ON CONFLICT(k, f) DO NOTHING RETURNING 1 AS inserted`,
      [key, field, String(value)],
    );
    return rows.length;
  }

  async hincrby(key: string, field: string, by: number): Promise<number> {
    // Atomic increment via INSERT ... ON CONFLICT DO UPDATE
    const rows = await d1Query<{ new_val: number }>(
      `INSERT INTO hash_kv (k, f, v) VALUES (?, ?, ?)
       ON CONFLICT(k, f) DO UPDATE SET v = CAST((CAST(v AS INTEGER) + ?) AS TEXT)
       RETURNING CAST(v AS INTEGER) AS new_val`,
      [key, field, String(by), by],
    );
    return rows[0]?.new_val ?? by;
  }

  async hincrbyfloat(key: string, field: string, by: number): Promise<number> {
    const rows = await d1Query<{ new_val: number }>(
      `INSERT INTO hash_kv (k, f, v) VALUES (?, ?, ?)
       ON CONFLICT(k, f) DO UPDATE SET v = CAST((CAST(v AS REAL) + ?) AS TEXT)
       RETURNING CAST(v AS REAL) AS new_val`,
      [key, field, String(by), by],
    );
    return rows[0]?.new_val ?? by;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    const placeholders = fields.map(() => "?").join(",");
    const rows = await d1Query<{ ok: number }>(
      `DELETE FROM hash_kv WHERE k = ? AND f IN (${placeholders}) RETURNING 1 AS ok`,
      [key, ...fields],
    );
    return rows.length;
  }

  // ─── Set ─────────────────────────────────────────────────────────────────
  async sadd(key: string, ...members: Array<string | number>): Promise<number> {
    if (members.length === 0) return 0;
    const stmts = members.map((m) => ({
      sql: `INSERT INTO set_kv (k, m) VALUES (?, ?) ON CONFLICT(k, m) DO NOTHING`,
      params: [key, String(m)] as Array<string | number | null>,
    }));
    await d1Batch(stmts);
    return members.length; // Best-effort — D1 batch nu raporteaza per-row
  }

  async sismember(key: string, member: string | number): Promise<number> {
    const rows = await d1Query<{ ok: number }>(
      `SELECT 1 AS ok FROM set_kv WHERE k = ? AND m = ? ${TTL_FILTER} LIMIT 1`,
      [key, String(member), NOW()],
    );
    return rows.length;
  }

  async scard(key: string): Promise<number> {
    const rows = await d1Query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM set_kv WHERE k = ? ${TTL_FILTER}`,
      [key, NOW()],
    );
    return rows[0]?.cnt ?? 0;
  }

  async srem(key: string, ...members: Array<string | number>): Promise<number> {
    if (members.length === 0) return 0;
    const placeholders = members.map(() => "?").join(",");
    const rows = await d1Query<{ ok: number }>(
      `DELETE FROM set_kv WHERE k = ? AND m IN (${placeholders}) RETURNING 1 AS ok`,
      [key, ...members.map(String)],
    );
    return rows.length;
  }

  async smembers(key: string): Promise<string[]> {
    const rows = await d1Query<{ m: string }>(
      `SELECT m FROM set_kv WHERE k = ? ${TTL_FILTER}`,
      [key, NOW()],
    );
    return rows.map((r) => r.m);
  }

  // ─── List ────────────────────────────────────────────────────────────────
  async lpush(key: string, ...values: Array<string | number>): Promise<number> {
    if (values.length === 0) return 0;
    // Generate sequential IDs descending so newest = highest
    const now = NOW();
    const stmts = values.map((v, i) => ({
      sql: `INSERT INTO list_kv (k, id, v) VALUES (?, ?, ?)`,
      params: [key, now * 1000 + i, String(v)] as Array<string | number | null>,
    }));
    await d1Batch(stmts);
    const rows = await d1Query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM list_kv WHERE k = ?`,
      [key],
    );
    return rows[0]?.cnt ?? 0;
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    // Redis indexing: 0 = newest. End -1 = end of list.
    // We store id ASC = oldest. Need to SELECT ORDER BY id DESC + slice.
    if (end === -1) end = 9999;
    const limit = end - start + 1;
    if (limit <= 0) return [];
    const rows = await d1Query<{ v: string }>(
      `SELECT v FROM list_kv WHERE k = ? ${TTL_FILTER} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [key, NOW(), limit, start],
    );
    return rows.map((r) => r.v);
  }

  async ltrim(key: string, start: number, end: number): Promise<"OK"> {
    // Keep only elements from index start to end (inclusive, newest-first).
    // Equivalent: delete rows OUTSIDE [start..end].
    if (end === -1) {
      // Keep from start onwards — delete first `start` newest
      await d1Exec(
        `DELETE FROM list_kv WHERE k = ? AND id IN (SELECT id FROM list_kv WHERE k = ? ORDER BY id DESC LIMIT ?)`,
        [key, key, start],
      );
    } else {
      const keep = end - start + 1;
      await d1Exec(
        `DELETE FROM list_kv WHERE k = ? AND id NOT IN (SELECT id FROM list_kv WHERE k = ? ORDER BY id DESC LIMIT ? OFFSET ?)`,
        [key, key, keep, start],
      );
    }
    return "OK";
  }

  // ─── Sorted Set ──────────────────────────────────────────────────────────
  async zadd(key: string, entry: { score: number; member: string | number }): Promise<number> {
    const rows = await d1Query<{ ok: number }>(
      `INSERT INTO zset_kv (k, m, s) VALUES (?, ?, ?) ON CONFLICT(k, m) DO UPDATE SET s = excluded.s RETURNING 1 AS ok`,
      [key, String(entry.member), entry.score],
    );
    return rows.length;
  }

  async zincrby(key: string, by: number, member: string | number): Promise<number> {
    const rows = await d1Query<{ new_score: number }>(
      `INSERT INTO zset_kv (k, m, s) VALUES (?, ?, ?) ON CONFLICT(k, m) DO UPDATE SET s = s + ? RETURNING s AS new_score`,
      [key, String(member), by, by],
    );
    return rows[0]?.new_score ?? by;
  }

  async zrange(
    key: string,
    start: number,
    end: number,
    opts?: { rev?: boolean; withScores?: boolean },
  ): Promise<Array<string | number>> {
    if (end === -1) end = 9999;
    const limit = end - start + 1;
    if (limit <= 0) return [];
    const order = opts?.rev ? "DESC" : "ASC";
    const rows = await d1Query<{ m: string; s: number }>(
      `SELECT m, s FROM zset_kv WHERE k = ? ${TTL_FILTER} ORDER BY s ${order}, m ${order} LIMIT ? OFFSET ?`,
      [key, NOW(), limit, start],
    );
    if (opts?.withScores) {
      const out: Array<string | number> = [];
      for (const r of rows) {
        out.push(r.m);
        out.push(r.s);
      }
      return out;
    }
    return rows.map((r) => r.m);
  }

  async zcard(key: string): Promise<number> {
    const rows = await d1Query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM zset_kv WHERE k = ? ${TTL_FILTER}`,
      [key, NOW()],
    );
    return rows[0]?.cnt ?? 0;
  }

  async zremrangebyrank(key: string, start: number, end: number): Promise<number> {
    // Delete members in rank range [start..end] (0 = lowest score, -1 = highest).
    const limit = end - start + 1;
    if (limit <= 0) return 0;
    const rows = await d1Query<{ ok: number }>(
      `DELETE FROM zset_kv WHERE k = ? AND m IN (
        SELECT m FROM zset_kv WHERE k = ? ORDER BY s ASC, m ASC LIMIT ? OFFSET ?
      ) RETURNING 1 AS ok`,
      [key, key, limit, start],
    );
    return rows.length;
  }

  // ─── Pipeline (batch executor for grouping multiple writes) ──────────────
  pipeline(): D1Pipeline {
    return new D1Pipeline(this);
  }
}

/**
 * Pipeline accumulates commands then flushes via batch on exec().
 * Toate metodele intoarce `this` pentru chaining stil Upstash.
 *
 * IMPORTANT: deoarece D1 wrapper-ul nostru e async per call, pipeline-ul
 * efectiv DOAR aggreaga apoi exec() face Promise.allSettled pe toate.
 * NU e cu adevarat tranzactional ca pipeline Redis — pentru analytics best-effort
 * e suficient.
 */
type PipelineOp = () => Promise<unknown>;

export class D1Pipeline {
  private ops: PipelineOp[] = [];
  constructor(private client: CiviaD1Client) {}

  hincrby(k: string, f: string, n: number): this {
    this.ops.push(() => this.client.hincrby(k, f, n));
    return this;
  }
  hset(k: string, fields: Record<string, string | number>): this {
    this.ops.push(() => this.client.hset(k, fields));
    return this;
  }
  hsetnx(k: string, f: string, v: string | number): this {
    this.ops.push(() => this.client.hsetnx(k, f, v));
    return this;
  }
  expire(k: string, sec: number): this {
    this.ops.push(() => this.client.expire(k, sec));
    return this;
  }
  sadd(k: string, ...m: Array<string | number>): this {
    this.ops.push(() => this.client.sadd(k, ...m));
    return this;
  }
  lpush(k: string, ...v: Array<string | number>): this {
    this.ops.push(() => this.client.lpush(k, ...v));
    return this;
  }
  ltrim(k: string, s: number, e: number): this {
    this.ops.push(() => this.client.ltrim(k, s, e));
    return this;
  }
  zadd(k: string, entry: { score: number; member: string | number }): this {
    this.ops.push(() => this.client.zadd(k, entry));
    return this;
  }
  zincrby(k: string, n: number, m: string | number): this {
    this.ops.push(() => this.client.zincrby(k, n, m));
    return this;
  }

  async exec(): Promise<unknown[]> {
    // Best-effort: execute all ops in parallel, swallow individual errors.
    const results = await Promise.allSettled(this.ops.map((op) => op()));
    return results.map((r) => (r.status === "fulfilled" ? r.value : null));
  }
}

// Singleton — null daca CF env lipseste (graceful fallback)
const hasD1 = !!CF_API_TOKEN && !!CF_ACCOUNT_ID && !!CF_D1_DB_ID;
export const analyticsD1: CiviaD1Client | null = hasD1 ? new CiviaD1Client() : null;
