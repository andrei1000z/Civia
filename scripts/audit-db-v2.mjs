// DB audit via PostgREST. exec_sql is write-only (returns {ok:true}).
import { readFileSync } from 'node:fs';
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rpc(name, body) {
  const r = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  return { status: r.status, body: t };
}

async function count(table) {
  const r = await fetch(`${URL}/rest/v1/${table}?select=count`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = r.headers.get('content-range') || '';
  // pattern: 0-0/N
  const m = cr.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function selectFirst(table, columns = '*') {
  const r = await fetch(`${URL}/rest/v1/${table}?select=${columns}&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return txt; }
}

const tables = (readFileSync('c:/tmp/tables.txt', 'utf8').split('\n').filter(l => l && !l.includes(':') && !l.startsWith('count')));

(async () => {
  // CRON LIST
  console.log('===== CRON_JOBS =====');
  const cron = await rpc('list_cron_jobs');
  console.log(cron.body);

  console.log('\n===== EXT_STATUS =====');
  const ext = await rpc('check_ext_status');
  console.log(ext.body);

  console.log('\n===== TABLE COUNTS =====');
  const results = [];
  for (const t of tables) {
    if (!t) continue;
    try {
      const c = await count(t);
      results.push({ table: t, count: c });
    } catch (e) {
      results.push({ table: t, error: String(e).slice(0, 80) });
    }
  }
  results.sort((a, b) => (b.count || 0) - (a.count || 0));
  for (const r of results) console.log(`${(r.count ?? 'ERR').toString().padStart(8)}  ${r.table}`);

  // Targeted introspection
  console.log('\n===== sesizari sample columns =====');
  console.log(JSON.stringify(await selectFirst('sesizari'), null, 2).slice(0, 1500));

  console.log('\n===== sesizare_replies sample =====');
  console.log(JSON.stringify(await selectFirst('sesizare_replies'), null, 2).slice(0, 1500));

  console.log('\n===== stiri_cache sample =====');
  console.log(JSON.stringify(await selectFirst('stiri_cache'), null, 2).slice(0, 1500));

  console.log('\n===== profiles sample =====');
  console.log(JSON.stringify(await selectFirst('profiles'), null, 2).slice(0, 1500));

  // recent inbox_debug_log size hint
  console.log('\n===== inbox_debug_log recent =====');
  const r = await fetch(`${URL}/rest/v1/inbox_debug_log?select=created_at&order=created_at.desc&limit=5`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  console.log(await r.text());

  // sesizari status distribution
  console.log('\n===== sesizari status distribution =====');
  const status = await fetch(`${URL}/rest/v1/sesizari?select=status`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const arr = JSON.parse(await status.text());
  const dist = {};
  for (const r of arr) dist[r.status] = (dist[r.status] || 0) + 1;
  console.log(JSON.stringify(dist, null, 2));

  // delivery_status distribution
  console.log('\n===== sesizari delivery_status distribution =====');
  const dr = await fetch(`${URL}/rest/v1/sesizari?select=delivery_status`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const arr2 = JSON.parse(await dr.text());
  const d2 = {};
  for (const r of arr2) d2[r.delivery_status || 'null'] = (d2[r.delivery_status || 'null'] || 0) + 1;
  console.log(JSON.stringify(d2, null, 2));

})();
