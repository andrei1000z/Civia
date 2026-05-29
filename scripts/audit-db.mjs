// Quick DB audit via Supabase exec_sql RPC
import 'dotenv/config';
import { readFileSync } from 'node:fs';

// Load .env.local manually because dotenv/config reads .env by default
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Missing env'); process.exit(1); }

async function exec(sql) {
  const r = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const text = await r.text();
  if (!r.ok) return { error: `HTTP ${r.status}: ${text}` };
  try { return { rows: JSON.parse(text) }; } catch { return { rows: text }; }
}

const queries = {
  rpc_exists: `select proname from pg_proc where proname in ('exec_sql','sql','query') and pronamespace=(select oid from pg_namespace where nspname='public') limit 5`,
  // try anyway, if missing we'll see error
};

const sections = [
  ['1_TOP_TABLES_BY_SIZE', `
    select n.nspname as schema, c.relname as table,
      pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
      pg_total_relation_size(c.oid) as total_bytes,
      pg_size_pretty(pg_relation_size(c.oid)) as heap_size,
      pg_size_pretty(pg_indexes_size(c.oid)) as idx_size,
      c.reltuples::bigint as est_rows
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public')
    order by pg_total_relation_size(c.oid) desc
    limit 20`],
  ['2_INDEXES_CORE_TABLES', `
    select schemaname, tablename, indexname, indexdef
    from pg_indexes
    where schemaname='public'
      and tablename in ('sesizari','petitii','stiri','sesizare_replies','profiles','inbox_messages','inbox_attachments')
    order by tablename, indexname`],
  ['3_RLS_STATUS', `
    select n.nspname as schema, c.relname as table,
      c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
      (select count(*) from pg_policy p where p.polrelid=c.oid) as n_policies
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname='public'
    order by rls_enabled asc, c.relname asc`],
  ['4_UNUSED_INDEXES', `
    select s.schemaname, s.relname as table, s.indexrelname as index,
      s.idx_scan, pg_size_pretty(pg_relation_size(s.indexrelid)) as size,
      pg_relation_size(s.indexrelid) as bytes,
      i.indisunique, i.indisprimary
    from pg_stat_user_indexes s
    join pg_index i on i.indexrelid = s.indexrelid
    where s.schemaname='public'
      and s.idx_scan < 10
      and not i.indisprimary
      and not i.indisunique
    order by pg_relation_size(s.indexrelid) desc
    limit 50`],
  ['5_COUNTS', `
    select 'sesizari' as t, count(*)::bigint as n from public.sesizari
    union all select 'sesizare_replies', count(*) from public.sesizare_replies
    union all select 'stiri', count(*) from public.stiri
    union all select 'petitii', count(*) from public.petitii
    union all select 'profiles', count(*) from public.profiles
    union all select 'inbox_messages', count(*) from public.inbox_messages
    union all select 'inbox_attachments', count(*) from public.inbox_attachments`],
  ['6_PG_CRON_JOBS', `
    select jobid, schedule, command, nodename, nodeport, database, username, active, jobname
    from cron.job
    order by jobid`],
  ['7_PG_CRON_RECENT_RUNS', `
    select job_pid, jobid, runid, status, return_message,
           start_time, end_time
    from cron.job_run_details
    where end_time > now() - interval '7 days'
    order by start_time desc
    limit 20`],
  ['8_FK_LIST', `
    select tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col,
           tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
    order by tc.table_name`],
  ['9_DUPLICATE_INDEXES', `
    select pg_size_pretty(sum(pg_relation_size(idx))::bigint) as size,
           (array_agg(idx))[1] as idx1, (array_agg(idx))[2] as idx2,
           (array_agg(idx))[3] as idx3, (array_agg(idx))[4] as idx4
    from (
      select indexrelid::regclass as idx, (indrelid::text||E'\\n'||indclass::text||E'\\n'||indkey::text||E'\\n'||
             coalesce(indexprs::text,'')||E'\\n' || coalesce(indpred::text,'')) as key
      from pg_index) sub
    group by key having count(*)>1
    order by sum(pg_relation_size(idx)) desc`],
  ['10_TABLES_WITHOUT_PK', `
    select n.nspname as schema, c.relname as table
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname='public'
      and not exists (
        select 1 from pg_constraint con where con.conrelid=c.oid and con.contype='p')
    order by c.relname`],
  ['11_BLOAT_HINT', `
    select schemaname, relname, n_dead_tup, n_live_tup,
           round(n_dead_tup::numeric / nullif(n_live_tup,0), 3) as dead_ratio,
           last_autovacuum, last_vacuum
    from pg_stat_user_tables
    where n_dead_tup > 1000
    order by n_dead_tup desc
    limit 20`],
  ['12_SEQUENTIAL_SCANS_HOT', `
    select schemaname, relname, seq_scan, idx_scan, n_live_tup,
           seq_tup_read, idx_tup_fetch
    from pg_stat_user_tables
    where n_live_tup > 1000 and seq_scan > coalesce(idx_scan,0) * 2
    order by seq_scan desc
    limit 20`],
  ['13_RLS_POLICIES_LIST', `
    select schemaname, tablename, policyname, cmd, roles::text, qual is not null as has_qual, with_check is not null as has_check
    from pg_policies where schemaname='public' order by tablename, policyname`],
  ['14_LARGEST_INDEXES', `
    select schemaname, relname as table, indexrelname as index,
           pg_size_pretty(pg_relation_size(indexrelid)) as size,
           idx_scan
    from pg_stat_user_indexes
    where schemaname='public'
    order by pg_relation_size(indexrelid) desc
    limit 15`],
  ['15_FK_WITHOUT_INDEX', `
    select c.conrelid::regclass as table,
           a.attname as fk_col,
           c.confrelid::regclass as ref_table,
           c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.contype='f' and c.connamespace=(select oid from pg_namespace where nspname='public')
      and not exists (
        select 1 from pg_index i
        where i.indrelid=c.conrelid
          and (c.conkey[1] = any (i.indkey::int[]))
          and i.indkey[0] = c.conkey[1]
      )
    order by c.conrelid::regclass::text`],
];

(async () => {
  console.log('--- Probe RPC ---');
  const probe = await exec('select current_database() as db, current_user as usr, version()');
  console.log(JSON.stringify(probe, null, 2).slice(0, 1000));

  for (const [name, sql] of sections) {
    console.log(`\n\n===== ${name} =====`);
    const res = await exec(sql);
    if (res.error) { console.log('ERROR:', res.error.slice(0, 800)); continue; }
    const rows = res.rows;
    if (!Array.isArray(rows)) { console.log('Non-array result:', String(rows).slice(0, 500)); continue; }
    console.log(`(${rows.length} rows)`);
    for (const r of rows) console.log(JSON.stringify(r));
  }
})();
